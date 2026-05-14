export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
}

export interface Role {
  id: string;
  name: string;
  permissions: string[];
}
