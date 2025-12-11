import * as dotenv from "dotenv";
dotenv.config();

import { handler } from "../lambda/authorizer";
import { Effect } from "aws-cdk-lib/aws-iam";

describe("Authorizer Lambda", () => {
    const mockEvent = {
        type: "REQUEST",
        methodArn: "arn:aws:execute-api:us-east-1:123456789012:abc123/test/GET/hello",
        httpMethod: "GET",
        path: "/hello",
        headers: {
            Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxMTIsInJvbGVzIjpbImFkbWluIiwidXNlciJdLCJpYXQiOjE3NjAxMDAzNTksImV4cCI6MTc2MDExNDc1OX0.uAIOCoxRIqrA6dq-skK-zJ6aZ-JFnPwh3XouQbR_hdg",
        },
    } as any;

    beforeEach(() => {
        jest.resetAllMocks();
    });

    it("should allow access when policy validation passes", async () => {
        const result = await handler(mockEvent);

        expect(result).toEqual({
            principalId: "112",
            policyDocument: {
                Version: "2012-10-17",
                Statement: [
                    {
                        Action: "execute-api:Invoke",
                        Effect: Effect.ALLOW,
                        Resource: mockEvent.methodArn,
                    },
                ],
            },
        });
    });

    it("should throw error when Authorization header is missing", async () => {
        const badEvent = { ...mockEvent, headers: {} };

        await expect(handler(badEvent)).rejects.toThrow("Missing Authorization token");
    });

    it("should throw error when validation fails", async () => {
        await expect(handler({
            ...mockEvent,
            headers: {
                Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxMTIsInJvbGVzIjpbInVzZXIiXSwiaWF0IjoxNzYwMTAwMzU5LCJleHAiOjE3NjAxMTQ3NTl9.CHd4luAw6awzw-O85qtgqIyGhK0vzqhzFLPpX0aGkZc",
            },
        })).rejects.toThrow("Unauthorized");
    });
});
