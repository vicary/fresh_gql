// deno-lint-ignore-file no-explicit-any

import type { IExecutableSchemaDefinition } from "@graphql-tools/schema";
import { makeExecutableSchema } from "@graphql-tools/schema";
import type { IFieldResolver, IResolvers } from "@graphql-tools/utils";
import type { GraphQLScalarType } from "https://esm.sh/graphql@16.6.0";

export type Callable = (...args: any[]) => any;

export type GraphQLModule = {
  schema?: string;
  resolver?:
    | GraphQLScalarType
    | IResolvers
    | IFieldResolver<any, any, any, any>;
};

export type Manifest = {
  modules: Record<string, GraphQLModule>;
  baseUrl: string;
};

export const fromManifest = <
  TManifest extends Manifest,
  TContext = unknown,
>(
  manifest: TManifest,
  options?: Omit<
    IExecutableSchemaDefinition<TContext>,
    "typeDefs" | "resolvers"
  >,
) => {
  const typeDefs = Object.values(manifest.modules).map((m) => m.schema).filter((
    schema,
  ): schema is string => !!schema?.trim());

  const resolvers = Object.entries(manifest.modules).map(
    ([name, { resolver }]): IResolvers | undefined => {
      if (!resolver) return;

      const resolverObj: IResolvers = {};
      const pathSegments = name.split(".");
      const isSubscription = pathSegments[0] === "Subscription";

      let currentPath = resolverObj;
      while (pathSegments.length > 1) {
        const segment = pathSegments.shift()!;
        currentPath[segment] = {};
        currentPath = currentPath[segment] as Record<never, never>;
      }

      currentPath[pathSegments.shift()!] = isSubscription
        ? { subscribe: resolver }
        : resolver;

      return resolverObj;
    },
  ).filter((resolver): resolver is IResolvers => !!resolver);

  const baseSchema = ["Query", "Mutation", "Subscription"].map((type) => {
    if (typeDefs.some((typeDef) => typeDef?.includes(`extend type ${type}`))) {
      return `type ${type}`;
    }
  }).join("\n");

  return makeExecutableSchema<TContext>({
    ...options,
    typeDefs: [baseSchema, ...typeDefs],
    resolvers,
  });
};
