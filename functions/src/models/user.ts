import { Producer } from "./producer";

export interface User {
    id: string;
    name: string;
    email: string;
    phone?: string;
    role?: string;
    producerId?: string;
    producer?: Partial<Producer>;
    createdAt: string;
    updatedAt: string;
}