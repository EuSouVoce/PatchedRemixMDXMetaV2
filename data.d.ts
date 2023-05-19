import { UNSAFE_DeferredData as DeferredData } from "@remix-run/router";
/**
 * Data for a route that was returned from a `loader()`.
 *
 * Note: This moves to unknown in ReactRouter and eventually likely in Remix
 */
export type AppData = any;
export declare function isCatchResponse(response: any): boolean;
export declare function isErrorResponse(response: any): boolean;
export declare function isRedirectResponse(response: any): boolean;
export declare function isDeferredResponse(response: any): boolean;
export declare function fetchData(request: Request, routeId: string): Promise<Response | Error>;
export declare function parseDeferredReadableStream(stream: ReadableStream<Uint8Array>): Promise<DeferredData>;
