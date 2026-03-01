export type UserRole = 'STUDENT' | 'TEACHER' | 'HEAD' | 'ADMIN';

export type Permission =
    | 'CREATE_COURSE'
    | 'UPDATE_COURSE'
    | 'DELETE_COURSE'
    | 'PUBLISH_COURSE'
    | 'CREATE_MODULE'
    | 'UPLOAD_CONTENT'
    | 'ENROLL_COURSE'
    | 'CREATE_ASSESSMENT'
    | 'UPDATE_ASSESSMENT'
    | 'DELETE_ASSESSMENT'
    | 'TAKE_ASSESSMENT'
    | 'GRADE_SUBMISSION'
    | 'VIEW_CLASS_ANALYTICS'
    | 'EXPORT_DATA';

export interface TokenData {
    sub: string;
    role: UserRole;
    exp: number;
    iat: number;
}

export interface User {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    class_level?: number;
    subject?: string;
    permissions: Permission[];
}

export interface LoginRequest {
    email: string;
    password: string;
}

export interface SignupRequest {
    name: string;
    first_name?: string;    // split from full name before sending to API
    last_name?: string;     // split from full name before sending to API
    email: string;
    password: string;
    role: UserRole;
    class_level?: number;
}

export interface ForgotPasswordRequest {
    email: string;
}

export interface AuthResponse {
    access_token: string;
    token_type: string;
    user: User;
}
