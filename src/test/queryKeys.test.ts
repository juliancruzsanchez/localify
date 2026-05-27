import { describe, it, expect } from "vitest";
import { queryKeys } from "@/queries/keys";

describe("queryKeys", () => {
  it("generates tracks key", () => {
    expect(queryKeys.tracks()).toEqual(["tracks"]);
  });

  it("generates track key with id", () => {
    expect(queryKeys.track("abc")).toEqual(["tracks", "abc"]);
  });

  it("generates albums key", () => {
    expect(queryKeys.albums()).toEqual(["albums"]);
  });

  it("generates album tracks key", () => {
    expect(queryKeys.albumTracks("x")).toEqual(["albums", "x", "tracks"]);
  });

  it("generates search key", () => {
    expect(queryKeys.search("hello")).toEqual(["search", "hello"]);
  });

  it("generates playlist tracks key", () => {
    expect(queryKeys.playlistTracks("p1")).toEqual(["playlists", "p1", "tracks"]);
  });
});
