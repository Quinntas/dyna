**Document: Implementing Pagination with the GraphQL API**

**Introduction**

This document explains how to implement pagination in your GraphQL queries to efficiently retrieve large datasets. We'll
cover the `limit`, `offset`, and `orderBy` parameters and how they translate to SQL queries.

**Core Concepts**

* **Pagination:** Pagination is a technique for dividing large sets of data into smaller, more manageable chunks, to
  improve the performance of queries.
* **`limit` Argument:** The `limit` argument specifies the maximum number of records to return in a single query.
* **`offset` Argument:** The `offset` argument specifies the number of records to skip before starting to return
  results.
* **`orderBy` Argument:** The `orderBy` argument determines the order in which records are returned, either ascending or
  descending.
* **`pagination` Input:** The pagination options are grouped under the `pagination` input object, which contains the
  `limit`, `offset`, and `orderBy` arguments.
* **Dynamic Schema:** Similar to filtering, the `pagination` input is dynamically generated as part of the graphql
  schema and available for use.

**Pagination Parameters**

* **`limit` (Int, required):** The maximum number of records to return in the query response.
* **`offset` (Int, required):** The number of records to skip before starting to return records.
* **`orderBy` (`PaginationOrderByEnum`, optional):** Specifies the order of results. It can be either "ASC" (ascending)
  or "DESC" (descending).

**General Syntax**

The general structure for using pagination with a `pagination` argument is as follows:

```graphql
query MyQuery($pagination: PaginationInput) {
    myObject(pagination: $pagination) {
        data {
        // ... fields
    }
    pagination{
        hasMore
        nextOffset
        total
    }
}
}
```

`PaginationInput` is a predefined input type with `limit`, `offset`, and `orderBy` fields.
The output type has a `pagination` object, which contains the `hasMore`, `nextOffset` and `total` fields.

**Example 1: Basic Pagination**

Let's say we want to fetch the first 5 users.

* **GraphQL Query:**

  ```graphql
  query GetFirstFiveUsers {
      users(pagination: { limit: 5, offset: 0 }) {
          data {
              id
              email
          }
          pagination {
            hasMore
            nextOffset
            total
          }
      }
  }
  ```
  Note: We're setting the `offset` to 0 to fetch from the beginning of the list.

* **SQL Equivalent:**

  ```sql
  SELECT id, email
  FROM users
  ORDER BY id ASC
  LIMIT 5
  OFFSET 0;
  ```

**Example 2: Fetching the Next Page**

Now, let's fetch the next 5 users, assuming the previous query started at offset 0 and had a limit of 5.

* **GraphQL Query:**

  ```graphql
  query GetNextFiveUsers {
      users(pagination: { limit: 5, offset: 5 }) {
          data {
              id
              email
          }
          pagination {
            hasMore
            nextOffset
              total
          }
      }
  }
  ```

  Note: We're setting the `offset` to 5, skipping the first 5 records.

* **SQL Equivalent:**

  ```sql
  SELECT id, email
  FROM users
  ORDER BY id ASC
  LIMIT 5
  OFFSET 5;
  ```

**Example 3: Using `orderBy` (Descending)**

Let's fetch the first 5 sessions, ordered by `id` in descending order.

* **GraphQL Query:**

  ```graphql
  query GetFirstFiveSessionsDesc {
      sessions(pagination: { limit: 5, offset: 0, orderBy: DESC }) {
          data {
              id
              name
          }
          pagination {
              hasMore
              nextOffset
                total
          }
      }
  }
  ```

* **SQL Equivalent:**

  ```sql
  SELECT id, name
  FROM sessions
  ORDER BY id DESC
  LIMIT 5
  OFFSET 0;
  ```

**Example 4: Using variables**

It is also possible to use variables with the `pagination` input, which makes it easy to fetch more data.

* **GraphQL Query:**

  ```graphql
  query GetUsers($pagination: PaginationInput) {
      users(pagination: $pagination) {
          data {
              id
              email
          }
          pagination {
            hasMore
            nextOffset
              total
          }
      }
  }
  ```
* **GraphQL Variables:**

  ```json
  {
    "pagination": {
      "limit": 5,
      "offset": 5,
      "orderBy": "ASC"
    }
  }
  ```
* **SQL Equivalent:**

  ```sql
  SELECT id, email
  FROM users
  ORDER BY id ASC
  LIMIT 5
  OFFSET 5;
  ```

**Understanding the Pagination Output**

The output of paginated queries will include a `pagination` object with the following fields:

* **`hasMore` (Boolean, required):** Indicates if there are more records available after the current page.
* **`nextOffset` (Int, required):**  The offset to use to fetch the next page of records.
* **`total` (Int, required):** The total number of records available.

**Important Considerations**

* **Consistency:** When using `orderBy`, make sure that the order is consistent between requests, otherwise results can
  be inconsistent.
* **Performance:**
    * Pagination significantly improves query performance, especially for large datasets, by returning only a subset of
      data.
    * However, using very large values for `limit` or `offset` might still affect the database performance.
* **User Experience:** Consider loading indicators and "Load More" buttons for a better user experience.
* **Data Integrity**: Make sure you don't re-request pages that you already have, as this may lead to duplication of
  data.
* **Initial Load**: Make sure you define default `limit` and `offset` to fetch the first page.
