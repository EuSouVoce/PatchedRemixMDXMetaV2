import * as React from "react";
import {
  UNSAFE_DataRouterStateContext as DataRouterStateContext,
  useLocation,
} from "react-router-dom";

import { UNSAFE_RemixContext } from "@remix-run/react";
import type { AppData } from "./data";
import type { RemixContextObject } from "./entry";
import invariant from "./invariant";
import type {
  V1_HtmlMetaDescriptor,
  V1_MetaFunction,
  V2_MetaDescriptor,
  V2_MetaFunction,
  V2_MetaMatch,
  V2_MetaMatches,
} from "./routeModules";

function useDataRouterStateContext() {
  let context = React.useContext(DataRouterStateContext);
  invariant(
    context,
    "You must render this element inside a <DataRouterStateContext.Provider> element"
  );
  return context;
}

function useRemixContext(): RemixContextObject {
  let context = React.useContext(UNSAFE_RemixContext);
  invariant(context, "You must render this element inside a <Remix> element");
  return context;
}

/**
 * Renders the `<title>` and `<meta>` tags for the current routes.
 *
 * @see https://remix.run/components/meta
 */
function V1Meta() {
  let { routeModules } = useRemixContext();
  let {
    errors,
    matches: routerMatches,
    loaderData,
  } = useDataRouterStateContext();
  let location = useLocation();

  let matches = errors
    ? routerMatches.slice(
        0,
        routerMatches.findIndex((m) => errors![m.route.id]) + 1
      )
    : routerMatches;

  let meta: V1_HtmlMetaDescriptor = {};
  let parentsData: { [routeId: string]: AppData } = {};

  for (let match of matches) {
    let routeId = match.route.id;
    let data = loaderData[routeId];
    let params = match.params;

    let routeModule = routeModules[routeId];

    if (routeModule.meta) {
      let routeMeta =
        typeof routeModule.meta === "function"
          ? (routeModule.meta as V1_MetaFunction)({
              data,
              parentsData,
              params,
              location,
            })
          : routeModule.meta;
      if (routeMeta && Array.isArray(routeMeta)) {
        throw new Error(
          "The route at " +
            match.route.path +
            " returns an array. This is only supported with the `v2_meta` future flag " +
            "in the Remix config. Either set the flag to `true` or update the route's " +
            "meta function to return an object." +
            "\n\nTo reference the v1 meta function API, see https://remix.run/route/meta"
          // TODO: Add link to the docs once they are written
          // + "\n\nTo reference future flags and the v2 meta API, see https://remix.run/file-conventions/remix-config#future-v2-meta."
        );
      }
      Object.assign(meta, routeMeta);
    }

    parentsData[routeId] = data;
  }

  return (
    <>
      {Object.entries(meta).map(([name, value]) => {
        if (!value) {
          return null;
        }

        if (["charset", "charSet"].includes(name)) {
          return <meta key="charSet" charSet={value as string} />;
        }

        if (name === "title") {
          return <title key="title">{String(value)}</title>;
        }

        // Open Graph tags use the `property` attribute, while other meta tags
        // use `name`. See https://ogp.me/
        //
        // Namespaced attributes:
        //  - https://ogp.me/#type_music
        //  - https://ogp.me/#type_video
        //  - https://ogp.me/#type_article
        //  - https://ogp.me/#type_book
        //  - https://ogp.me/#type_profile
        //
        // Facebook specific tags begin with `fb:` and also use the `property`
        // attribute.
        //
        // Twitter specific tags begin with `twitter:` but they use `name`, so
        // they are excluded.
        let isOpenGraphTag =
          /^(og|music|video|article|book|profile|fb):.+$/.test(name);

        return [value].flat().map((content) => {
          if (isOpenGraphTag) {
            return (
              <meta
                property={name}
                content={content as string}
                key={name + content}
              />
            );
          }

          if (typeof content === "string") {
            return <meta name={name} content={content} key={name + content} />;
          }

          return <meta key={name + JSON.stringify(content)} {...content} />;
        });
      })}
    </>
  );
}

function V2Meta() {
  let { routeModules } = useRemixContext();
  let {
    errors,
    matches: routerMatches,
    loaderData,
  } = useDataRouterStateContext();
  let location = useLocation();

  let _matches = errors
    ? routerMatches.slice(
        0,
        routerMatches.findIndex((m) => errors![m.route.id]) + 1
      )
    : routerMatches;

  let meta: V2_MetaDescriptor[] = [];
  let leafMeta: V2_MetaDescriptor[] | null = null;
  let matches: V2_MetaMatches = [];
  for (let i = 0; i < _matches.length; i++) {
    let _match = _matches[i];
    let routeId = _match.route.id;
    let data = loaderData[routeId];
    let params = _match.params;
    let routeModule = routeModules[routeId];
    let routeMeta: V2_MetaDescriptor[] | V1_HtmlMetaDescriptor | undefined = [];

    let match: V2_MetaMatch = {
      id: routeId,
      data,
      meta: [],
      params: _match.params,
      pathname: _match.pathname,
      handle: _match.route.handle,
      // TODO: Remove in v2. Only leaving it for now because we used it in
      // examples and there's no reason to crash someone's build for one line.
      // They'll get a TS error from the type updates anyway.
      // @ts-expect-error
      get route() {
        console.warn(
          "The meta function in " +
            _match.route.path +
            " accesses the `route` property on `matches`. This is deprecated and will be removed in Remix version 2. See"
        );
        return _match.route;
      },
    };
    matches[i] = match;

    if (routeModule?.meta) {
      routeMeta =
        typeof routeModule.meta === "function"
          ? (routeModule.meta as V2_MetaFunction)({
              data,
              params,
              location,
              matches,
            })
          : Array.isArray(routeModule.meta)
          ? [...routeModule.meta]
          : routeModule.meta;
    } else if (leafMeta) {
      // We only assign the route's meta to the nearest leaf if there is no meta
      // in the route. The meta function may return a false value which
      // is effectively the same as an empty array.
      routeMeta = [...leafMeta];
    }

    routeMeta = routeMeta || [];
    if (!Array.isArray(routeMeta)) {
      throw new Error(
        "The `v2_meta` API is enabled in the Remix config, but the route at " +
          _match.route.path +
          " returns an invalid value. In v2, all route meta functions must " +
          "return an array of meta objects." +
          // TODO: Add link to the docs once they are written
          // "\n\nTo reference future flags and the v2 meta API, see https://remix.run/file-conventions/remix-config#future-v2-meta." +
          "\n\nTo reference the v1 meta function API, see https://remix.run/route/meta"
      );
    }

    match.meta = routeMeta;
    matches[i] = match;
    meta = [...routeMeta];
    leafMeta = meta;
  }

  return (
    <>
      {meta.flat().map((metaProps) => {
        if (!metaProps) {
          return null;
        }

        if ("tagName" in metaProps) {
          let tagName = metaProps.tagName;
          delete metaProps.tagName;
          if (!isValidMetaTag(tagName)) {
            console.warn(
              `A meta object uses an invalid tagName: ${tagName}. Expected either 'link' or 'meta'`
            );
            return null;
          }
          let Comp = tagName;
          return <Comp key={JSON.stringify(metaProps)} {...metaProps} />;
        }

        if ("title" in metaProps) {
          return <title key="title">{String(metaProps.title)}</title>;
        }

        if ("charset" in metaProps) {
          metaProps.charSet ??= metaProps.charset;
          delete metaProps.charset;
        }

        if ("charSet" in metaProps && metaProps.charSet != null) {
          return typeof metaProps.charSet === "string" ? (
            <meta key="charSet" charSet={metaProps.charSet} />
          ) : null;
        }

        if ("script:ld+json" in metaProps) {
          let json: string | null = null;
          try {
            json = JSON.stringify(metaProps["script:ld+json"]);
          } catch (err) {}
          return (
            json != null && (
              <script
                key="script:ld+json"
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                  __html: JSON.stringify(metaProps["script:ld+json"]),
                }}
              />
            )
          );
        }
        if (
          Object.keys(metaProps).length == 1 &&
          Object.entries(metaProps)[0].length == 2
        ) {
          return (
            <meta
              key={JSON.stringify(metaProps)}
              name={`${Object.entries(metaProps)[0][0]}`}
              content={`${Object.entries(metaProps)[0][1]}`}
            />
          );
        }

        return <meta key={JSON.stringify(metaProps)} {...metaProps} />;
      })}
    </>
  );
}

function isValidMetaTag(tagName: unknown): tagName is "meta" | "link" {
  return typeof tagName === "string" && /^(meta|link)$/.test(tagName);
}

export function Meta() {
  let { future } = useRemixContext();
  return future?.v2_meta ? <V2Meta /> : <V1Meta />;
}
