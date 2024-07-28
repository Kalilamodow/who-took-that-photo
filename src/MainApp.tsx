import { useEffect, useState } from "react";
import c from "./ComponentAliases";
import Game from "./Views/Game";
import Lobby from "./Views/Lobby";
import MainMenu from "./Views/MainMenu";
import WTTPClient from "./WTTPClient";

import { useColorScheme } from "react-native";
import { updateCss } from "./ComponentAliases";
import { setTheme } from "./DefaultStyles";

export default function App() {
  const [currentView, setCurrentView] = useState<
    "menu" | "lobby" | "game"
  >("menu");

  const [activeClient, setActiveClient] = useState<
    WTTPClient | undefined
  >();

  const currentColorScheme = useColorScheme();

  useEffect(() => {
    const url = process.env.EXPO_PUBLIC_BACKEND;
    if (!url)
      throw new Error("no backend url provided in enviroment vars");
    setActiveClient(new WTTPClient(url));
  }, []);

  useEffect(() => {
    const theme = currentColorScheme || "light";
    setTheme(theme);
    updateCss();
  }, [currentColorScheme]);

  function onCreateGame(n: string) {
    activeClient?.createGame(n).then(() => setCurrentView("lobby"));
  }

  function onJoinGame(n: string, g: string) {
    activeClient?.joinGame(n, g).then(() => setCurrentView("lobby"));
  }

  return (
    <c.Root>
      {currentView == "menu" ? (
        <MainMenu
          joinGame={onJoinGame}
          createGame={onCreateGame}
          setImages={i => activeClient?.setImages(i)}
        />
      ) : currentView == "lobby" ? (
        <Lobby
          client={activeClient!}
          toGameScreen={() => setCurrentView("game")}
          toMainMenu={() => setCurrentView("menu")}
        />
      ) : currentView == "game" ? (
        <Game client={activeClient!} />
      ) : (
        <>
          <c.Header1>Unknown View</c.Header1>
          <c.Text>Try restarting the game.</c.Text>
          <c.Text>
            Error details: `currentView` is set to "{currentView}" (
            {typeof currentView}) - does not match possible types?
          </c.Text>
        </>
      )}
    </c.Root>
  );
}
