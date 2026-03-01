import { CLASS_LEVELS } from '../constants';

export function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isStrongPassword(password: string): boolean {
    return (
        password.length >= 8 &&
        /[A-Z]/.test(password) &&
        /[a-z]/.test(password) &&
        /[0-9]/.test(password)
    );
}

export function isValidClassLevel(level: number): boolean {
    return (CLASS_LEVELS as readonly number[]).includes(level);
}

export function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

export function isWithinRange(value: number, min: number, max: number): boolean {
    return value >= min && value <= max;
}

export function isValidFileType(file: File, allowedTypes: string[]): boolean {
    return allowedTypes.includes(file.type);
}

export function isValidFileSize(file: File, maxMB: number): boolean {
    return file.size <= maxMB * 1024 * 1024;
}
