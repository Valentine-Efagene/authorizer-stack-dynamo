import Ajv, { ValidateFunction } from "ajv";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { PolicyDocument, Effect, RolePolicy } from "./type";
import { PolicyJsonSchema } from "./role-policy.schema";

export class RolePolicyService {
    private validateFn: ValidateFunction;
    private dynamoDb: DynamoDBDocumentClient;
    private cachedPolicies: RolePolicy[] | null = null;
    private lastFetchTime = 0;

    constructor(
        private readonly tableName: string
    ) {
        const ajv = new Ajv({ allErrors: true, strict: false });
        this.validateFn = ajv.compile(PolicyJsonSchema);

        const client = new DynamoDBClient({});
        this.dynamoDb = DynamoDBDocumentClient.from(client);
    }

    /**
     * Lazy-loads policies from DynamoDB (cached across Lambda invocations)
     */
    private async loadPoliciesFromDynamoDB(forceRefresh = false): Promise<RolePolicy[]> {
        const FIVE_MINUTES = 5 * 60 * 1000;

        // Reuse cache if not too old and no forced refresh
        if (
            this.cachedPolicies &&
            !forceRefresh &&
            Date.now() - this.lastFetchTime < FIVE_MINUTES
        ) {
            return this.cachedPolicies;
        }

        console.log("Fetching role policies from DynamoDB...");

        const command = new ScanCommand({
            TableName: this.tableName,
            FilterExpression: "attribute_not_exists(isActive) OR isActive = :active",
            ExpressionAttributeValues: {
                ":active": true,
            },
        });

        const response = await this.dynamoDb.send(command);

        if (!response.Items || response.Items.length === 0) {
            console.warn("No role policies found in DynamoDB");
            this.cachedPolicies = [];
            this.lastFetchTime = Date.now();
            return [];
        }

        const parsed = response.Items as RolePolicy[];
        for (const rp of parsed) {
            this.validatePolicy(rp.policy);
        }

        this.cachedPolicies = parsed;
        this.lastFetchTime = Date.now();

        console.log(`Loaded ${parsed.length} policies from DynamoDB`);

        return parsed;
    }

    /**
     * Validates structure of a policy document against the schema
     */
    private validatePolicy(policy: PolicyDocument) {
        const valid = this.validateFn(policy);
        if (!valid) {
            const errors = this.validateFn.errors?.map(
                (e) => `${e.instancePath || "(root)"} ${e.message}`
            );
            throw new Error(`Invalid policy schema: ${errors?.join(", ")}`);
        }
    }

    /**
     * Checks whether the provided roles are authorized
     */
    async validateRequest(
        roles: string[],
        method: string,
        route: string
    ): Promise<boolean> {
        const allPolicies = await this.loadPoliciesFromDynamoDB();
        const rows = allPolicies.filter((r) => roles.includes(r.roleName));
        const policies = rows.map((r) => r.policy);
        return this.isAuthorized(policies, method, route);
    }

    /**
     * Main authorization logic
     */
    public async isAuthorized(
        policies: PolicyDocument[],
        method: string,
        route: string
    ): Promise<boolean> {
        const upperMethod = method.toUpperCase();
        const allStatements = policies.flatMap((p) => p.statements || []);

        let allowed = false;

        for (const stmt of allStatements) {
            for (const resource of stmt.resources) {
                const pathMatches = this.matchPattern(resource.path, route);
                const methodMatches = resource.methods.includes(upperMethod);

                if (pathMatches && methodMatches) {
                    if (stmt.effect === Effect.DENY) return false; // Deny always wins
                    if (stmt.effect === Effect.ALLOW) allowed = true;
                }
            }
        }

        return allowed;
    }

    /**
     * Matches route patterns like `/users/:id` or `/users/*`
     */
    private matchPattern(pattern: string, value: string): boolean {
        const regexPattern =
            "^" +
            pattern.replace(/:[^/]+/g, "[^/]+").replace(/\*/g, ".*") +
            "$";
        return new RegExp(regexPattern).test(value);
    }
}
