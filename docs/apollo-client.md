**Document: Implementing Pagination with the GraphQL API**

**Project Setup Assumptions**

1. **Apollo Client Setup:** You have Apollo Client set up in your React application and connected to the GraphQL API.
2. **GraphQL Code Generator:** You have a tool like `graphql-code-generator` configured to generate TypeScript types
   from your GraphQL schema (introspection).
3. **Generated Types:**  We assume that you have a file containing generated types from the introspection of your
   graphql endpoint, and that it contains the types `GetUsersQuery`, `UsersFilters`, and `PaginationInput`. You also
   have access to the `PaginationOrderByEnum` as an enum in typescript.
4. **Typescript**: All code will be written in typescript.

**1. Install Required Packages**

If you don't have them already, install the following packages:

```bash
npm install @apollo/client graphql
```

**2. Define GraphQL Query (using gql)**

Create a file (e.g., `src/graphql/queries.ts`) and define your GraphQL query with types:

```typescript
// src/graphql/queries.ts
import {gql} from "@apollo/client";

export const GET_USERS = gql`
    query GetUsers($where: UsersFilters, $pagination: PaginationInput) {
        users(where: $where, pagination: $pagination) {
            data {
                id
                email
                role
            }
            pagination {
                hasMore
                nextOffset
                total
            }
        }
    }
`;
```

**3. Custom Hooks**

Create a directory to contain our custom hooks `src/hooks/`.

**3.1 usePaginatedQuery Hook**

Create a custom hook for fetching paginated data (`src/hooks/usePaginatedQuery.ts`):

```typescript
// src/hooks/usePaginatedQuery.ts
import {useQuery} from '@apollo/client';
import {useCallback, useState} from 'react';
import {PaginationOrderByEnum} from '../types/generated';
import {type PaginationInput} from '../types/generated';

interface UsePaginatedQueryProps<TData, TVariables> {
    query: any; // Should be a gql query
    initialVariables?: TVariables;
    itemsPerPage?: number;
}

interface UsePaginatedQueryResult<TData, TVariables> {
    loading: boolean;
    error: any;
    data: TData | undefined;
    fetchMore: (variables?: TVariables) => void;
    pagination: {
        hasMore: boolean;
        nextOffset: number;
        total: number;
    }
    variables: TVariables
    setVariables: (variables: TVariables) => void
    reset: () => void
}

const defaultPagination: PaginationInput = {
    limit: 5,
    offset: 0,
    orderBy: PaginationOrderByEnum.ASC
}
const usePaginatedQuery = <TData, TVariables extends { pagination?: PaginationInput, where?: any } = {
    pagination?: PaginationInput,
    where?: any
}>({
       query,
       initialVariables,
       itemsPerPage = 5,
   }: UsePaginatedQueryProps<TData, TVariables>): UsePaginatedQueryResult<TData, TVariables> => {
    const [variables, setVariablesState] = useState<TVariables>({
        ...initialVariables,
        pagination: {...defaultPagination, limit: itemsPerPage}
    } as TVariables);
    const {loading, error, data, fetchMore} = useQuery<TData>(query, {
        variables
    });

    const setVariables = (newVariables: TVariables) => {
        setVariablesState(newVariables);
    };

    const handleFetchMore = useCallback(() => {
        if (!data || !('users' in data) || !data.users) return;

        // @ts-expect-error asd
        if (data.users.pagination.hasMore) {
            // @ts-expect-error asd
            fetchMore({
                variables: {
                    pagination: {
                        limit: itemsPerPage,
                        // @ts-expect-error asd
                        offset: data.users.pagination.nextOffset,
                    },
                },
            });
        }
    }, [data, fetchMore, itemsPerPage]);

    const pagination = data && 'users' in data && data.users && data.users.pagination ?
        {
            // @ts-expect-error asd
            hasMore: data.users.pagination.hasMore,
            // @ts-expect-error asd
            nextOffset: data.users.pagination.nextOffset,
            // @ts-expect-error asd
            total: data.users.pagination.total,
        }
        : {
            hasMore: false,
            nextOffset: 0,
            total: 0
        }

    const reset = () => {
        setVariablesState({...initialVariables, pagination: {...defaultPagination, limit: itemsPerPage}} as TVariables)
    }


    return {
        loading,
        error,
        data,
        fetchMore: handleFetchMore,
        pagination,
        variables,
        setVariables,
        reset
    };
};

export default usePaginatedQuery;
```

**3.2 useDebouncedState Hook**

Create a custom hook to handle debounced state changes (`src/hooks/useDebouncedState.ts`):

```typescript
// src/hooks/useDebouncedState.ts
import {useState, useEffect} from 'react';

function useDebouncedState<T>(initialValue: T, delay: number): [T, (value: T) => void] {
    const [value, setValue] = useState(initialValue);
    const [debouncedValue, setDebouncedValue] = useState(initialValue);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return [debouncedValue, setValue];
}

export default useDebouncedState;

```

**4. Create a Component**

Now, let's use the custom hook in a component (e.g., `src/components/UsersList.tsx`):

```typescript
// src/components/UsersList.tsx
import React from 'react';
import usePaginatedQuery from '../hooks/usePaginatedQuery';
import {GET_USERS} from '../graphql/queries';
import {GetUsersQuery, UsersFilters, PaginationOrderByEnum} from '../types/generated';
import useDebouncedState from '../hooks/useDebouncedState';


const UsersList = () => {
    const [emailFilter, setEmailFilter] = useDebouncedState<string>('', 500);
    const [roleFilter, setRoleFilter] = useDebouncedState<string>('', 500)
    const {
        loading,
        error,
        data,
        fetchMore,
        pagination,
        setVariables,
        variables,
        reset
    } = usePaginatedQuery<GetUsersQuery, { where?: UsersFilters }>({
        query: GET_USERS,
        initialVariables: {
            where: {}
        }
    });

    const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setEmailFilter(e.target.value);
    };
    const handleRoleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setRoleFilter(e.target.value);
    };


    React.useEffect(() => {
        setVariables({
            where: {
                email: {
                    ilike: `%${emailFilter}%`
                },
                role: {
                    eq: roleFilter
                }
            }
        })
    }, [emailFilter, roleFilter])


    if (loading) return <p>Loading
...
    </p>;
    if (error) return <p>Error
:
    {
        error.message
    }
    </p>;

    if (!data || !data.users || !data.users.data) return <p>No
    users
    found. < /p>;


    const handleReset = () => {
        reset()
        setEmailFilter('')
        setRoleFilter('')
    }

    return (
        <div>
            <div>
                <input type = "text"
    placeholder = "Filter by email"
    value = {emailFilter}
    onChange = {handleEmailChange}
    />
    < input
    type = "text"
    placeholder = "Filter by role"
    value = {roleFilter}
    onChange = {handleRoleChange}
    />
    < /div>
    < ul >
    {
        data.users.data.map((user) => (
            <li key = {user.id} >
                {user.email} - {user.role}
                < /li>
        ))
    }
    < /ul>
    {
        pagination.hasMore && <button onClick = {fetchMore} > Load
        More < /button>}
        < button
        onClick = {handleReset} > Reset < /button>
            < /div>
    )
        ;
    }
    ;

    export default UsersList;
```

**Explanation:**

1. **Import necessary elements:** Imports the usePaginatedQuery and useDebouncedState custom hooks, our generated types
   and the `GET_USERS` query.
2. **`usePaginatedQuery`:** We utilize the `usePaginatedQuery` hook to manage our data fetching and pagination state.
    * We specify our query, initialVariables and the data type.
    * The hook returns loading, error, data, fetchMore, pagination, setVariables, and variables.
3. **Debounced State:** We are using `useDebouncedState` to create a debounced state which updates only when the user
   stops typing, this helps prevent unnecessary queries.
4. **`fetchMore` function:** Calls the `fetchMore` function to load more data using the new pagination offset.
5. **`setVariables` Function:** Calls the `setVariables` to update the where clause and trigger a refetch.
6. **Rendering:** Maps the data to list elements and renders them. Also renders a "Load More" button, which is only
   available when there is more data.
7. **Reset Button:** Resets the current search and pagination.
8. **Typescript**: We are passing the `GetUsersQuery` which is generated from the graphql schema.

**Key Points**

* **Generated Types:** This example depends heavily on generated types to ensure type safety throughout.
* **Custom Hooks:** The `usePaginatedQuery` and `useDebouncedState` hooks promote reusable logic, and make the
  components more readable.
* **Loading State:** The component has a simple loading state handler.
* **Error Handling:** The component has a basic error handling mechanism. You can implement more sophisticated error
  handling as needed.
* **Fetch More:** The component implements basic fetch more functionality to paginate through the results.
* **Filter:** The component implements a basic filter by email and role.
* **Reset:** The component provides a way to reset the filters and pagination.

**Next Steps**

1. **Integrate with your Apollo Client setup:** Make sure that your Apollo Client configuration is correct, and that you
   have a `<ApolloProvider />` wrapping your application.
2. **Configure code generation:** Ensure that the GraphQL code generator is correctly configured and generating the
   types you need.
3. **Customize to your needs:** Adapt the custom hooks and the component to match your application's specific
   requirements.
4. **Error handling:** Implement better error handling.
5. **UI improvements:** Add loading indicators for when you are fetching data.
6. **Pagination improvements:** Add better pagination controls, like a pagination control.
