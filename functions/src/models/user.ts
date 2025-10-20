import {AssetRef} from "./asset";
import {Company} from "./company";
import {Producer} from "./producer";

export interface User {
    id: string;
    name: string;
    email: string;
    phone?: string;
    role?: string;
    profilePic?: AssetRef;
    producerId?: string;
    companyId?: string;
    company?: Partial<Company>;
    producer?: Partial<Producer>;
    createdAt: string;
    updatedAt: string;
}
