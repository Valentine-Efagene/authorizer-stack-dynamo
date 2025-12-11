import * as dotenv from "dotenv";
dotenv.config();

import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambdaNode from "aws-cdk-lib/aws-lambda-nodejs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import path from "path";

export class AuthorizerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // === DynamoDB Table for Role Policies ===
    const policiesTable = new dynamodb.Table(this, "RolePoliciesTable", {
      partitionKey: { name: "roleName", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "RolePolicies",
    });

    // === Authorizer Lambda ===
    const authorizerFn = new lambdaNode.NodejsFunction(this, "AuthorizerFunction", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, "../lambda/authorizer.ts"),
      handler: "handler",
      bundling: {
        minify: process.env.NODE_ENV === "production",
      },
      environment: {
        POLICIES_TABLE_NAME: policiesTable.tableName,
      },
    });

    // Grant read permissions to the authorizer Lambda
    policiesTable.grantReadData(authorizerFn);

    // === API Lambda ===
    const apiFn = new lambdaNode.NodejsFunction(this, "ApiFunction", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, "../lambda/api.ts"),
      handler: "handler",
    });

    // === API Gateway ===
    const api = new apigateway.RestApi(this, "DemoApi", {
      restApiName: "Demo API with Custom Authorizer",
      description: "API Gateway with Lambda Authorizer for testing.",
    });

    // === Lambda Authorizer Integration ===
    const authorizer = new apigateway.RequestAuthorizer(this, "CustomRequestAuthorizer", {
      handler: authorizerFn,
      identitySources: [apigateway.IdentitySource.header("Authorization")],
      resultsCacheTtl: cdk.Duration.seconds(0),
    });

    // === /hello endpoint ===
    const hello = api.root.addResource("hello");
    hello.addMethod("GET", new apigateway.LambdaIntegration(apiFn), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
    });

    new cdk.CfnOutput(this, "ApiUrl", {
      value: `${api.url}hello`,
    });
  }
}
