import {
    type PaginationInputDTO,
    paginationInputObject,
    type PaginationOutputDTO,
    paginationOutputObject,
} from '../../graphql/pagination';
import {genInputFiltersFromTable} from '../../utils/genInputFieldsFromTable';
import {userTable} from "./user.table.ts";

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
