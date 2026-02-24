import type { SearchEngineId } from "../types";

export interface SearchEngineConfig {
  id: SearchEngineId;
  name: string;
  searchUrl: string;
  queryParam: string;
  logo: React.ReactNode;
}

const GOOGLE_LOGO = (
  <svg
    viewBox="0 0 24 24"
    className="size-5 shrink-0"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

const BING_LOGO = (
  <svg
    viewBox="0 0 24 24"
    className="size-5 shrink-0"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M3 3v18l5.5-3.2 6.5 3.7 5-2.8V7.5L14.5 5 9 7V3H3zm6 6.4 5.5 2.1v3.8l-5.5 3.2V9.4z"
      fill="#0C8484"
    />
  </svg>
);

const DUCKDUCKGO_LOGO = (
  <svg
    viewBox="0 0 24 24"
    className="size-5 shrink-0"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm0 .984C18.083.984 23.016 5.916 23.016 12S18.084 23.016 12 23.016.984 18.084.984 12C.984 5.917 5.916.984 12 .984zm0 .938C6.434 1.922 1.922 6.434 1.922 12c0 4.437 2.867 8.205 6.85 9.55-.237-.82-.776-2.753-1.6-6.052-1.184-4.741-2.064-8.606 2.379-9.813.047-.011.064-.064.03-.093-.514-.467-1.382-.548-2.233-.38a.06.06 0 0 1-.07-.058c0-.011 0-.023.011-.035.205-.286.572-.507.822-.64a1.843 1.843 0 0 0-.607-.335c-.059-.022-.059-.12-.006-.144.006-.006.012-.012.024-.012 1.749-.233 3.586.292 4.49 1.448.011.011.023.017.035.023 2.968.635 3.509 4.837 3.328 5.998a9.607 9.607 0 0 0 2.346-.576c.746-.286 1.008-.222 1.101-.053.1.193-.018.513-.28.81-.496.567-1.393 1.01-2.974 1.137-.546.044-1.029.024-1.445.006-.789-.035-1.339-.059-1.633.39-.192.298-.041.998 1.487 1.22 1.09.157 2.078.047 2.798-.034.643-.07 1.073-.118 1.172.069.21.402-.996 1.207-3.066 1.224-.158 0-.315-.006-.467-.011-1.283-.065-2.227-.414-2.816-.735a.094.094 0 0 1-.035-.017c-.105-.059-.31.045-.188.267.07.134.444.478 1.004.776-.058.466.087 1.184.338 2l.088-.016c.041-.009.087-.019.134-.025.507-.082.775.012.926.175.717-.536 1.913-1.294 2.03-1.154.583.694.66 2.332.53 2.99-.004.012-.017.024-.04.035-.274.117-1.783-.296-1.783-.511-.059-1.075-.26-1.173-.493-1.225h-.156c.006.006.012.018.018.03l.052.12c.093.257.24 1.063.13 1.26-.112.199-.835.297-1.284.303-.443.006-.543-.158-.637-.408-.07-.204-.103-.675-.103-.95a.857.857 0 0 1 .012-.216c-.134.058-.333.193-.397.281-.017.262-.017.682.123 1.149.07.221-1.518 1.164-1.74.99-.227-.181-.634-1.952-.459-2.67-.187.017-.338.075-.42.191-.367.508.093 2.933.582 3.248.257.169 1.54-.553 2.176-1.095.105.145.305.158.553.158.326-.012.782-.06 1.103-.158.192.45.423.972.613 1.388 4.47-1.032 7.803-5.037 7.803-9.82 0-5.566-4.512-10.078-10.078-10.078zm1.791 5.646c-.42 0-.678.146-.795.332-.023.047.047.094.094.07.14-.075.357-.161.701-.156.328.006.516.09.67.159l.023.01c.041.017.088-.03.059-.065-.134-.18-.332-.35-.752-.35zm-5.078.198a1.24 1.24 0 0 0-.522.082c-.454.169-.67.526-.67.76 0 .051.112.057.141.011.081-.123.21-.31.617-.478.408-.17.73-.146.951-.094.047.012.083-.041.041-.07a.989.989 0 0 0-.558-.211zm5.434 1.423a.651.651 0 0 0-.655.647.652.652 0 0 0 1.307 0 .646.646 0 0 0-.652-.647zm.283.262h.008a.17.17 0 0 1 .17.17c0 .093-.077.17-.17.17a.17.17 0 0 1-.17-.17c0-.09.072-.165.162-.17zm-5.358.076a.752.752 0 0 0-.758.758c0 .42.338.758.758.758s.758-.337.758-.758a.756.756 0 0 0-.758-.758zm.328.303h.01c.112 0 .2.089.2.2 0 .11-.088.197-.2.197a.195.195 0 0 1-.197-.198c0-.107.082-.194.187-.199z"
      fill="#DE5833"
    />
  </svg>
);

const YAHOO_LOGO = (
  <svg
    viewBox="0 0 24 24"
    className="size-5 shrink-0"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12.727 13.708 18.545 3H15.2l-3.2 6.5L8.8 3H5.455l5.818 10.708V21h1.454v-7.292z"
      fill="#720E9E"
    />
  </svg>
);

const BRAVE_LOGO = (
  <svg
    viewBox="0 0 24 24"
    className="size-5 shrink-0"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 2 7 4l-.5 3L5 8l1.5 4-.5 3 2 2.5L12 22l4-4.5 2-2.5-.5-3L19 8l-1.5-1 .5-3-5-2z"
      fill="#FB542B"
    />
    <path
      d="m12 7-3 2v3l3 4 3-4V9l-3-2z"
      fill="#FFF"
    />
  </svg>
);

const ECOSIA_LOGO = (
  <svg
    viewBox="0 0 24 24"
    className="size-5 shrink-0"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="12" cy="12" r="10" fill="#36ACBF" />
    <path
      d="M12 6c-1.5 0-3 1-3 3s1.5 3 3 5 3 3 3 5c2-1.5 3-4 3-7a9 9 0 0 0-6-6z"
      fill="#FFF"
    />
  </svg>
);

export const BROWSER_DEFAULT_LOGO = (
  <svg
    viewBox="0 0 24 24"
    className="size-5 shrink-0"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z" />
  </svg>
);

export const SEARCH_ENGINES: Record<
  Exclude<SearchEngineId, "default">,
  SearchEngineConfig
> = {
  google: {
    id: "google",
    name: "Google",
    searchUrl: "https://www.google.com/search",
    queryParam: "q",
    logo: GOOGLE_LOGO,
  },
  bing: {
    id: "bing",
    name: "Bing",
    searchUrl: "https://www.bing.com/search",
    queryParam: "q",
    logo: BING_LOGO,
  },
  duckduckgo: {
    id: "duckduckgo",
    name: "DuckDuckGo",
    searchUrl: "https://duckduckgo.com/",
    queryParam: "q",
    logo: DUCKDUCKGO_LOGO,
  },
  yahoo: {
    id: "yahoo",
    name: "Yahoo",
    searchUrl: "https://search.yahoo.com/search",
    queryParam: "p",
    logo: YAHOO_LOGO,
  },
  brave: {
    id: "brave",
    name: "Brave",
    searchUrl: "https://search.brave.com/search",
    queryParam: "q",
    logo: BRAVE_LOGO,
  },
  ecosia: {
    id: "ecosia",
    name: "Ecosia",
    searchUrl: "https://www.ecosia.org/search",
    queryParam: "q",
    logo: ECOSIA_LOGO,
  },
};

export const SEARCH_ENGINE_OPTIONS: {
  value: SearchEngineId;
  label: string;
}[] = [
  { value: "google", label: "Google" },
  { value: "bing", label: "Bing" },
  { value: "duckduckgo", label: "DuckDuckGo" },
  { value: "yahoo", label: "Yahoo" },
  { value: "brave", label: "Brave" },
  { value: "ecosia", label: "Ecosia" },
  { value: "default", label: "Browser default" },
];
