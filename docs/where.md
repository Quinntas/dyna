**Document: Understanding and Using `where` Filters in the GraphQL API**

**Introduction**

This document explains how to use the `where` input argument in the GraphQL API to filter data. It focuses on how these
filters translate to SQL `WHERE` clauses, providing practical examples for clarity.

**Core Concepts**

* **`where` Argument:** The `where` argument in your GraphQL queries allows you to specify conditions for filtering the
  data returned by the server.
* **Dynamic Filtering:** The API dynamically generates filter types based on your database schema, so filters will vary
  depending on the table and columns.
* **SQL Translation:** The provided examples show how the `where` filters are translated to SQL `WHERE` clauses.

**Filter Operators**

The following filter operators are supported within the `where` argument:

| Operator     | Description                                               | SQL Equivalent |
|--------------|-----------------------------------------------------------|----------------|
| `eq`         | Equal to                                                  | `=`            |
| `gt`         | Greater than                                              | `>`            |
| `gte`        | Greater than or equal to                                  | `>=`           |
| `lt`         | Less than                                                 | `<`            |
| `lte`        | Less than or equal to                                     | `<=`           |
| `inArray`    | Value is in the given array                               | `IN`           |
| `notInArray` | Value is not in the given array                           | `NOT IN`       |
| `isNull`     | Value is `NULL` (takes a boolean `true` value)            | `IS NULL`      |
| `isNotNull`  | Value is not `NULL` (takes a boolean `true` value)        | `IS NOT NULL`  |
| `like`       | Value matches the given pattern (case-sensitive)          | `LIKE`         |
| `notLike`    | Value does not match the given pattern (case-sensitive)   | `NOT LIKE`     |
| `ilike`      | Value matches the given pattern (case-insensitive)        | `ILIKE`        |
| `notIlike`   | Value does not match the given pattern (case-insensitive) | `NOT ILIKE`    |

**General Syntax**

The general structure for using filters with a `where` argument is as follows:

```graphql
query MyQuery($where: MyTypeFilters) {
    myObject(where: $where) {
    // ... fields
}
}
```

`MyTypeFilters` will be generated dynamically based on the table you are requesting.
Inside the filter object, you can chain multiple fields, with multiple filters for each field.

**Example 1: Filtering by Equality (`eq`)**

Let's say we want to fetch users with a specific email address.

* **GraphQL Query:**

  ```graphql
  query GetUserByEmail($email: String!) {
    users(where: { email: { eq: $email } }) {
      data {
        id
        email
      }
    }
  }
  ```

* **GraphQL Variables:**

  ```json
  {
    "email": "test@test.com"
  }
  ```

* **SQL Equivalent:**

  ```sql
  SELECT id, email
  FROM users
  WHERE email = 'test@test.com';
  ```

**Example 2: Filtering by Greater Than (`gt`)**

Let's say we want to fetch sessions with an id greater than 5.

* **GraphQL Query:**

  ```graphql
  query GetSessionById($id: Int!) {
    sessions(where: { id: { gt: $id } }) {
      data {
        id
        name
      }
    }
  }
  ```

* **GraphQL Variables:**

  ```json
  {
    "id": 5
  }
  ```

* **SQL Equivalent:**

  ```sql
  SELECT id, name
  FROM sessions
  WHERE id > 5;
  ```

**Example 3: Filtering with Multiple Conditions (`and`)**

Suppose we need to fetch users with an email that matches a certain pattern and has a specific role.

* **GraphQL Query:**

  ```graphql
  query GetUsersByEmailAndRole($emailLike: String!, $role: String!) {
    users(where: {
        email: { ilike: $emailLike }
        role: { eq: $role}
    }) {
      data {
        id
        email
        role
      }
    }
  }
  ```

* **GraphQL Variables:**

  ```json
  {
    "emailLike": "%test%",
     "role": "user"
  }
  ```

* **SQL Equivalent:**

  ```sql
  SELECT id, email, role
  FROM users
  WHERE email ILIKE '%test%' AND role = 'user';
  ```

**Example 4: Filtering with `inArray`**

Let's say we want to fetch users where their `role` is either `"user"` or `"admin"`.

* **GraphQL Query:**

  ```graphql
  query GetUsersByRole($roles: [String!]!) {
    users(where: { role: { inArray: $roles } }) {
      data {
        id
        role
      }
    }
  }
  ```

* **GraphQL Variables:**

  ```json
  {
    "roles": ["user", "admin"]
  }
  ```

* **SQL Equivalent:**

  ```sql
  SELECT id, role
  FROM users
  WHERE role IN ('user', 'admin');
  ```

**Example 5: Filtering with `isNull` and `isNotNull`**

Let's say we want to fetch sessions where their name is null.

* **GraphQL Query:**

  ```graphql
  query GetSessionsWhereNameIsNull {
    sessions(where: {name: {isNull: true}}) {
      data {
        id
        name
      }
    }
  }
  ```

* **SQL Equivalent:**

  ```sql
  SELECT id, name
  FROM sessions
  WHERE name IS NULL;
  ```

And let's say we want to fetch sessions where their name is not null.

* **GraphQL Query:**

  ```graphql
  query GetSessionsWhereNameIsNotNull {
      sessions(where: {name: {isNotNull: true}}) {
          data {
              id
              name
          }
      }
  }
  ```

* **SQL Equivalent:**

  ```sql
  SELECT id, name
  FROM sessions
  WHERE name IS NOT NULL;
  ```

**Example 6: Filtering with `like`, `notLike`, `ilike`, and `notIlike`**

Let's say we want to fetch users where the email starts with "test".

* **GraphQL Query:**

  ```graphql
  query GetUsersByEmailLike($emailLike: String!) {
    users(where: { email: { like: $emailLike } }) {
      data {
        id
        email
      }
    }
  }
  ```

* **GraphQL Variables:**

   ```json
    {
       "emailLike": "test%"
    }
   ```

* **SQL Equivalent:**

  ```sql
  SELECT id, email
  FROM users
  WHERE email LIKE 'test%';
  ```

**Important Considerations**

* **Type Safety:** Always ensure your GraphQL variables match the expected types defined in your schema.
* **Performance:** Using complex `like` or `ilike` filters with wildcards (`%`) at the beginning of a string can degrade
  performance. Use them wisely.
* **Security:** Be cautious about allowing arbitrary user input directly in `like` filters. Validate user inputs before
  passing them to your GraphQL queries.
