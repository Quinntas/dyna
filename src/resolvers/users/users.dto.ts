import {genInputFiltersFromTable} from '../../utils/genInputFieldsFromTable';
import {userTable} from "./user.table.ts";
import {
    type PaginationInputDTO,
    paginationInputObject,
    type PaginationOutputDTO,
    paginationOutputObject
} from "../../graphql/objects/pagination.ts";

export interface UsersInputDTO {
    pagination: PaginationInputDTO;
}

export interface UsersOutputDTO {
    pagination: PaginationOutputDTO;
}

export const usersInputFields = {
    where: {
        type: genInputFiltersFromTable('User', userTable),
    },
    pagination: {
        type: paginationInputObject,
    },
};

export const usersOutputFields = {
    pagination: {
        type: paginationOutputObject,
    },
};
