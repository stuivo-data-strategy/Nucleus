export interface Person {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
}
export interface Employment {
    id: string;
    personId: string;
    positionId: string;
    costCentreId: string;
    status: string;
}
