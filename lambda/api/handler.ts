import { APIGatewayProxyHandler } from 'aws-lambda';

export const handler: APIGatewayProxyHandler = async (event) => {
    console.log('Event:', JSON.stringify(event));
    return {
        statusCode: 200,
        body: JSON.stringify({
            message: 'Hello',
            user: event.requestContext.authorizer,
        }),
    };
};
