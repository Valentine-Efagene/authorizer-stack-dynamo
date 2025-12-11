import {
    APIGatewayRequestAuthorizerEvent,
    APIGatewayAuthorizerResult,
} from "aws-lambda";
import { jwtDecode } from "jwt-decode";
import { IAuthData } from "./type";
import { Effect } from "aws-cdk-lib/aws-iam";
import { RolePolicyService } from "./role-policy.service";

const policyService = new RolePolicyService(
    process.env.POLICIES_TABLE_NAME!
);

/**
 * Lambda Authorizer — validates JWT and checks against role-based policies
 */
export const handler = async (
    event: APIGatewayRequestAuthorizerEvent
): Promise<APIGatewayAuthorizerResult> => {
    console.log("Received event:", JSON.stringify(event));

    try {
        // --- 1️⃣ Extract and decode JWT
        const token =
            event.headers?.["Authorization"]?.replace("Bearer ", "") ??
            event.headers?.["authorization"]?.replace("Bearer ", "") ??
            "";

        if (!token) {
            console.warn("Missing Authorization token");
            throw new Error("Unauthorized");
        }

        const decoded = jwtDecode<IAuthData>(token);
        const roles = decoded.roles ?? [];

        if (!roles.length) {
            console.warn("User has no roles");
            throw new Error("Unauthorized");
        }

        // --- 2️⃣ Get method and path from event
        const method = event.httpMethod ?? event.requestContext.httpMethod;
        const path =
            event.path ??
            event.requestContext.resourcePath ??
            event.requestContext.path ??
            "";

        // --- 3️⃣ Validate against policies
        const isAuthorized = await policyService.validateRequest(
            roles,
            method,
            path
        );

        // --- 4️⃣ Return IAM policy
        if (isAuthorized) {
            return generatePolicy(
                `${decoded.user_id ?? "anonymous"}`,
                Effect.ALLOW,
                event.methodArn
            );
        } else {
            console.warn("Access denied by role policy:", {
                roles,
                method,
                path,
            });
            throw new Error("Unauthorized");
        }
    } catch (err) {
        console.error("Authorization error:", err);
        throw new Error("Unauthorized");
    }
};

/**
 * Helper to generate IAM-style policy for API Gateway
 */
function generatePolicy(
    principalId: string,
    effect: "Allow" | "Deny",
    resource: string
): APIGatewayAuthorizerResult {
    return {
        principalId,
        policyDocument: {
            Version: "2012-10-17",
            Statement: [
                {
                    Action: "execute-api:Invoke",
                    Effect: effect,
                    Resource: resource,
                },
            ],
        },
    };
}
