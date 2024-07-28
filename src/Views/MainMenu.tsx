import { useEffect, useState } from "react";
import { Alert, Platform } from "react-native";
import c from "../ComponentAliases";

import * as ImageLibrary from "expo-image-picker";

import AsyncStorage from "@react-native-async-storage/async-storage";

function alert(title: string, body?: string) {
  Alert.alert(title, body);
}

type MainMenuProps = {
  createGame: (name: string) => any;
  joinGame: (name: string, gameId: string) => any;
  setImages: (imageList: string[]) => any;
};

const minimumImages = 1;

function MainMenu(props: MainMenuProps) {
  const usernameInput = useState("");
  const gameIdInput = useState("");
  const headerPadding = useState(0);

  const images = useState<string[]>([]);

  useEffect(() => {
    if (Platform.OS == "android") {
      headerPadding[1](20);
    }
  }, []);

  useEffect(() => {
    if (!usernameInput[0]) return;
    AsyncStorage.setItem("saved username", usernameInput[0]);
  }, [usernameInput]);

  useEffect(() => {
    AsyncStorage.getItem("saved username").then(name => {
      if (name) usernameInput[1](name);
    });
  }, []);

  async function pickImages() {
    const { status } =
      await ImageLibrary.requestMediaLibraryPermissionsAsync();
    if (status != "granted") {
      alert(
        "Camera roll permissions have been denied. Change your settings to resolve this issue.",
      );
    }

    // granted
    const result = await ImageLibrary.launchImageLibraryAsync({
      allowsMultipleSelection: true,
    });

    if (result.canceled) return;

    const uris = result.assets.map(asset => asset.uri);
    props.setImages(uris);
    images[1](uris);

    if (uris.length < minimumImages) {
      alert(
        "Warning",
        `At least ${minimumImages} images are required to join or create a game.`,
      );
    }
  }

  function _createGame(name: string) {
    if (name.trim().length == 0) {
      return alert("Please provide a name");
    }

    if (images[0].length < minimumImages) {
      return alert(`Must have ${minimumImages} or more images.`);
    }

    props.createGame(name);
  }

  function _joinGame(name: string, code: string) {
    if (name.trim().length == 0) {
      return alert("Please provide a name");
    }

    if (images[0].length < minimumImages) {
      return alert(`Must have ${minimumImages} or more images.`);
    }

    code = code.trim();
    if (code.length == 0) {
      return alert("Provide a join code");
    }

    for (let i = 0; i < code.length; i++) {
      const ch = code.charAt(i);
      const int = parseInt(ch, 16);

      if (Number.isNaN(int)) {
        return alert("Invalid join code");
      }
    }

    props.joinGame(name, code);
  }

  return (
    <>
      <c.Header1 cstyle={{ marginTop: headerPadding[0], marginBottom: 10 }}>
        Who Took That Photo?
      </c.Header1>
      <c.TextInput
        onChangeText={usernameInput[1]}
        value={usernameInput[0]}
        placeholder='Your Name'
        autoComplete='off'
        autoCorrect={false}
        contextMenuHidden={true}
        cstyle={{
          fontSize: 18,
          width: 300,
          marginTop: 0,
        }}
        enterKeyHint={"done"}
      />

      <c.Button onclick={pickImages}>
        Choose Images ({images[0].length})
      </c.Button>

      <c.Header2>Join Game</c.Header2>

      <c.TextInput
        onChangeText={gameIdInput[1]}
        value={gameIdInput[0]}
        placeholder='Game ID'
        autoComplete='off'
        autoCorrect={false}
        contextMenuHidden={true}
        enterKeyHint={"done"}
        inputMode='numeric'
      />

      <c.Button
        onclick={() => _joinGame(usernameInput[0], gameIdInput[0])}>
        Join
      </c.Button>

      <c.Header2 cstyle={{ marginBottom: 0 }}>Create Game</c.Header2>
      <c.Button onclick={() => _createGame(usernameInput[0])}>
        Create
      </c.Button>
    </>
  );
}

export default MainMenu;
