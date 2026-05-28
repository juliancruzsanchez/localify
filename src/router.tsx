import { createBrowserRouter } from "react-router";
import App from "./App";
import { HomeView } from "./views/HomeView";
import { SongsView } from "./views/SongsView";
import { AlbumsView } from "./views/AlbumsView";
import { AlbumDetailView } from "./views/AlbumDetailView";
import { ArtistsView } from "./views/ArtistsView";
import { ArtistDetailView } from "./views/ArtistDetailView";
import { PlaylistDetailView } from "./views/PlaylistDetailView";
import { SearchView } from "./views/SearchView";
import { SettingsView } from "./views/SettingsView";
import { LikedSongsView } from "./views/LikedSongsView";
import { PluginRouteView } from "./views/PluginRouteView";
import { VisualizerView } from "./views/VisualizerView";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <HomeView /> },
      { path: "songs", element: <SongsView /> },
      { path: "search", element: <SearchView /> },
      { path: "albums", element: <AlbumsView /> },
      { path: "albums/:id", element: <AlbumDetailView /> },
      { path: "artists", element: <ArtistsView /> },
      { path: "artists/:id", element: <ArtistDetailView /> },
      { path: "playlists/:id", element: <PlaylistDetailView /> },
      { path: "settings", element: <SettingsView /> },
      { path: "liked", element: <LikedSongsView /> },
      { path: "visualizer", element: <VisualizerView /> },
      { path: "plugins/*", element: <PluginRouteView /> },
    ],
  },
]);
