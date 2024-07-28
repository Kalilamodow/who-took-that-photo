import { useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import c from "../ComponentAliases";
import WTTPClient from "../WTTPClient";

const styles = StyleSheet.create({
  exitButtons: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  startGameButton: {
    color: "#0c0",
    fontSize: 20,
    fontWeight: "bold",
    padding: 2,
  },
});

function Lobby({
  client,
  toMainMenu,
  toGameScreen,
}: {
  client: WTTPClient;
  toMainMenu: () => void;
  toGameScreen: () => void;
}) {
  const [joinedPlayers, setJoinedPlayers] = useState<string[]>([
    "Loading",
  ]);

  // initial get players in lobby
  useEffect(() => {
    const players = client.getPlayersInLobby();
    if (!players) {
      // kick
      setJoinedPlayers(["Loading"]);
      client.leaveGame();
      toMainMenu();
      return;
    }

    setJoinedPlayers(players);
  }, []);

  // handle game started
  useEffect(() => {
    const sub = client.addListener("lobby:startGame", () =>
      toGameScreen(),
    );

    return () => sub.remove();
  }, []);

  // Handle player join
  useEffect(() => {
    const joinSub = client.addListener("lobby:playerJoined", name => {
      setJoinedPlayers(current => [...current, name]);
    });

    const leftSub = client.addListener("lobby:playerLeft", name => {
      setJoinedPlayers(current => current.filter(x => x != name));
    });

    const kickSub = client.addListener("lobby:kicked", reason => {
      setJoinedPlayers(["Loading"]);
      toMainMenu();
      console.warn("Kicked with reason:", reason);
    });

    // Clean up the listener on unmount
    return () => {
      joinSub.remove();
      leftSub.remove();
      kickSub.remove();
    };
  }, [client]);

  function leaveGame() {
    Alert.alert(
      "Leave Game",
      "Are you sure you would like to leave the game?" +
        (client.gameData?.isCreator
          ? " This will disconnect all players as you are the admin."
          : ""),
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Leave",
          style: "destructive",
          onPress: () => {
            setJoinedPlayers(["Loading"]);
            client.leaveGame();
            toMainMenu();
          },
        },
      ],
    );
  }

  return (
    <>
      <c.Header1 cstyle={{ marginTop: 20 }}>
        Game Code: {client.gameData?.gameCode}
      </c.Header1>
      <c.Header3 cstyle={{ marginTop: 0 }}>
        Your Name: {client.gameData?.playerName}
      </c.Header3>

      <c.Hr />

      <c.Header4>Players</c.Header4>
      <c.List
        data={joinedPlayers}
        keyExtractor={(item, idx) => `${Math.random()}${item}${idx}`}
      />

      <c.Hr />

      {client.gameData?.isCreator ? (
        // joinedPlayers.length > 1 ? (
        joinedPlayers.length > 0 ? (
          <c.Button
            onclick={() => client.startGame()}
            innerStyle={styles.startGameButton}>
            Start Game
          </c.Button>
        ) : (
          <c.Header2>Need 1 more person</c.Header2>
        )
      ) : (
        <c.Header2>Waiting to start...</c.Header2>
      )}

      <View style={styles.exitButtons}>
        <c.Button
          onclick={() => leaveGame()}
          innerStyle={{ color: "red" }}>
          Leave
        </c.Button>
      </View>
    </>
  );
}

export default Lobby;
