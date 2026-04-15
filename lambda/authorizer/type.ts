export interface IAuthData {
    user_id: number,
    roles: Role[],
    iat: string,
    exp: string
}

export enum Role {
    ADMIN = 'admin',
    DEVELOPER = 'developer',
    MORTGAGE_OPERATOR = 'mortgage_operator',
    SALES = 'sales',
    USER = 'user',
    LEGAL = 'legal',
    AGENT = 'agent',
    PMB = 'pmb',
    MOFI_ADMIN = 'mofi_admin',
    PROJECT_MANAGER = 'project_manager',
    FINANCE = 'finance',
    SUPER_ADMIN = 'super_admin',
    SUPPORT = 'support',
}

export enum Effect {
    ALLOW = "Allow",
    DENY = "Deny",
}

export type PolicyResource = {
    path: string;
    methods: string[];
};

export type RolePolicy = {
    id: number;
    roleName: string;
    policy: PolicyDocument;
    isActive?: boolean;
};

export type PolicyStatement = {
    effect: Effect;
    resources: PolicyResource[];
};

export type PolicyDocument = {
    version?: string;
    statements: PolicyStatement[];
};

export type CreateRolePolicy = {
    roleName: string;
    policy: PolicyDocument;
    isActive?: boolean;
    updatedById?: number;
};

export type UpdateRolePolicy = {
    roleName?: string;
    policy?: PolicyDocument;
    isActive?: boolean;
    updatedById?: number;
};

export type CreateRolePolicyWithoutUser = Omit<CreateRolePolicy, "updatedById">;
export type UpdateRolePolicyWithoutUser = Omit<UpdateRolePolicy, "updatedById">;
