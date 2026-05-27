import { createBrowserRouter } from "react-router";
import App from "./App";
import { SongsView } from "./views/SongsView";
import { AlbumsView } from "./views/AlbumsView";
import { AlbumDetailView } from "./views/AlbumDetailView";
import { ArtistsView } from "./views/ArtistsView";
import { ArtistDetailView } from "./views/ArtistDetailView";
import { PlaylistDetailView } from "./views/PlaylistDetailView";
import { SearchView } from "./views/SearchView";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <SongsView /> },
      { path: "songs", element: <SongsView /> },
      { path: "search", element: <SearchView /> },
      { path: "albums", element: <AlbumsView /> },
      { path: "albums/:id", element: <AlbumDetailView /> },
      { path: "artists", element: <ArtistsView /> },
      { path: "artists/:id", element: <ArtistDetailView /> },
      { path: "playlists/:id", element: <PlaylistDetailView /> },
    ],
  },
]);
