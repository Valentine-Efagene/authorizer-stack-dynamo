export const PolicyJsonSchema = {
    type: 'object',
    properties: {
        version: { type: 'string', nullable: true },
        statements: {
            type: 'array',
            minItems: 1,
            items: {
                type: 'object',
                required: ['effect', 'resources'],
                properties: {
                    effect: { type: 'string', enum: ['Allow', 'Deny'] },
                    resources: {
                        type: 'array',
                        minItems: 1,
                        items: {
                            type: 'object',
                            required: ['path', 'methods'],
                            properties: {
                                path: { type: 'string', minLength: 1 },
                                methods: {
                                    type: 'array',
                                    minItems: 1,
                                    items: {
                                        type: 'string',
                                        pattern: '^[A-Z]+$', // e.g. GET, POST, DELETE
                                    },
                                },
                            },
                            additionalProperties: false,
                        },
                    },
                },
                additionalProperties: false,
            },
        },
    },
    required: ['statements'],
    additionalProperties: false,
} as const;