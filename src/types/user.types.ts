export interface CurrentUser {
  id: string;
  email: string;
  role?: {
    id: string;
    name: string;
    permissions: Array<{
      id: string;
      role_id: string;
      permission_id: string;
      permission: {
        id: string;
        name: string;
        description?: string;
      };
    }>;
  };
  permissions: string[];
  profile?: {
    id: string;
    first_name?: string;
    last_name?: string;
    avatar?: string;
    phone?: string;
    birth_date?: Date;
    gender?: string;
    country?: string;
    city?: string;
    address?: string;
    postal_code?: string;
    preferences?: any;
  };
}
