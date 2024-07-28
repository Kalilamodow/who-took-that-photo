import { io, Socket } from "socket.io-client";
import EventEmitter, {
  EmitterSubscription,
} from "react-native/Libraries/vendor/emitter/EventEmitter";

type ScoreList = Record<string, number>;

type GameData = {
  playerName: string;
  gameCode: string;
  otherPlayers: string[];
  isCreator: boolean;
  gameState?: {
    ourScore: number;
    currentRound: number;
    otherPlayersScores: Array<{ name: string; score: number }>;
  };
};

declare interface WTTPClient {
  /** Called when a player joins the lobby. */
  addListener(
    event: "lobby:playerJoined",
    listener: (playerName: string) => any,
  ): EmitterSubscription;

  /** Called when a player leaves the lobby. */
  addListener(
    event: "lobby:playerLeft",
    listener: (playerName: string) => any,
  ): EmitterSubscription;

  /** Called when you're kicked from the lobby. */
  addListener(
    event: "lobby:kicked",
    listener: (reason: string) => any,
  ): EmitterSubscription;

  /** Called when the game is started. */
  addListener(
    event: "lobby:startGame",
    listener: () => any,
  ): EmitterSubscription;

  /** Called when a round finishes. */
  addListener(
    event: "game:roundOver",
    listener: (scores: ScoreList) => any,
  ): EmitterSubscription;

  /** Called when the round starts. */
  addListener(
    event: "game:roundStart",
    listener: (image: string, choices: string[]) => any,
  ): EmitterSubscription;

  /** Called when the game ends. */
  addListener(
    event: "game:gameOver",
    listener: (scores: ScoreList) => any,
  ): EmitterSubscription;

  /** Called when the time left in the
   * current round is updated. */
  addListener(
    event: "game:timeLeftInRound",
    listener: (timeLeft: number) => any,
  ): EmitterSubscription;
}

/**
 * Utility for the client.
 */
class WTTPClient extends EventEmitter {
  socketio: Socket;
  gameData?: GameData;
  ourImages: string[];
  config?: {
    rounds: number;
    roundLength: number;
  };

  constructor(serverUrl: string) {
    super();

    this.socketio = io(serverUrl, {
      timeout: 5e3, // 5 seconds
      autoConnect: false,
    });

    this.socketio.once("connect", async () => {
      const c = await this.socketio
        .timeout(2000)
        .emitWithAck("c:ask:config");
      this.config = c;
    });

    this.ourImages = [];

    this.socketio.connect();
  }

  async joinGame(name: string, code: string) {
    const canJoin: number = await this.socketio.emitWithAck(
      "c:ask:menu/join",
      {
        name,
        gameId: code,
      },
    );

    if (canJoin != 0) return canJoin;

    this.gameData = {
      playerName: name,
      gameCode: code,
      otherPlayers: [],
      isCreator: false,
    };

    // wait for delay (Python is slow)
    await new Promise(r => setTimeout(r, 50));

    const response: string[] | number = await this.socketio.emitWithAck(
      "c:ask:lobby/get-players-in-game",
      code,
    );

    if (typeof response == "number") {
      console.error("error in gpig:", response);
      return;
    }

    this.gameData.otherPlayers = response.filter(
      theirName => theirName != name,
    );

    this._addLobbyListeners();

    return;
  }

  async createGame(name: string) {
    const gameCode = await this.socketio.emitWithAck(
      "c:ask:menu/create",
      name,
    );

    if (typeof gameCode != "string") {
      throw new Error(
        "emitWithAck(c:ask:menu/create) Was improperly acknowledged. This is probably a server error.",
      );
    }

    this.gameData = {
      playerName: name,
      gameCode: gameCode,
      otherPlayers: [],
      isCreator: true,
    };

    this._addLobbyListeners();
  }

  startGame() {
    if (!this.gameData?.isCreator) return;
    this.socketio.emit("c:say:lobby/start-game", this.gameData.gameCode);
  }

  setImages(images: string[]) {
    this.ourImages = [...images];
  }

  public sendAnswer(ans: string) {
    if (!this.gameData?.gameCode) return;

    this.socketio.emit(
      "c:say:game/choose-answer",
      this.gameData.gameCode,
      ans,
    );
  }

  public getConfig() {
    if (!this.config)
      throw new Error(
        "client/getConfig: Config has not been received yet",
      );

    return this.config;
  }

  private async _pickImage() {
    // pick random
    const imagePath =
      this.ourImages[Math.floor(Math.random() * this.ourImages.length)];

    // type: <any> because i can't figure out how to get
    // the right interface
    const blob = await new Promise<Blob>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = function () {
        resolve(xhr.response);
      };
      xhr.onerror = function (e) {
        console.log(e);
        reject(new TypeError("Network request failed"));
      };
      xhr.responseType = "blob";
      xhr.open("GET", imagePath, true);
      xhr.send(null);
    });

    return new Promise<string>(resolve => {
      const reader = new FileReader();

      reader.onload = event => {
        const url = event.target!.result as string;
        (blob as any).close();

        resolve(url);
      };

      reader.readAsDataURL(blob);
    });
  }

  private _addGameListeners() {
    // request-image: does not require an event
    this.socketio.on(
      "s:ask:game/request-image",
      async (callback: (image: string) => void) => {
        const image = await this._pickImage();
        callback(image);
      },
    );

    this.socketio.on("s:say:game/round-over", (scores: ScoreList) => {
      if (!this.gameData?.gameState) return;

      this.gameData.gameState.ourScore = scores[this.gameData!.playerName];
      const asArray = Object.entries(scores).map(([name, score]) => ({
        name,
        score,
      }));

      this.gameData.gameState.otherPlayersScores = asArray.filter(
        x => x.name != this.gameData!.playerName,
      );

      this.emit("game:roundOver", scores);
    });

    // no event
    this.socketio.on("s:say:game/sync-round", (roundNum: number) => {
      this.gameData!.gameState!.currentRound = roundNum;
      this.emit("game:syncRound", roundNum);
    });

    // round-start
    this.socketio.on(
      "s:say:game/round-start",
      ({ image, options }: { image: string; options: string[] }) =>
        this.emit("game:roundStart", image, options),
    );

    this.socketio.on("s:say:game/game-ended", (scores: ScoreList) => {
      this.emit("game:gameOver", scores);
    });

    this.socketio.on(
      "s:say:game/time-left-in-round",
      (timeLeft: number) => {
        this.emit("game:timeLeftInRound", timeLeft);
      },
    );
  }

  private _addLobbyListeners() {
    this.socketio.on("s:say:lobby:player-joined", (name: string) => {
      this.gameData?.otherPlayers.push(name);
      this.emit("lobby:playerJoined", name);
    });

    this.socketio.on("s:say:lobby:player-left", (name: string) => {
      if (this.gameData) {
        this.gameData.otherPlayers = this.gameData.otherPlayers.filter(
          x => x != name,
        );
      }

      this.emit("lobby:playerLeft", name);
    });

    this.socketio.on("s:say:lobby:lobby-del", () => {
      this.emit("lobby:kicked", "Creator left");
      this.leaveGame();
    });

    this.socketio.once("s:say:lobby/game-started", () => {
      this.emit("lobby:startGame");

      this.gameData!.gameState = {
        ourScore: 0,
        currentRound: -1,
        otherPlayersScores: this.getPlayersInLobby()!.map(x => ({
          name: x,
          score: 0,
        })),
      };

      this._addGameListeners();
    });
  }

  leaveGame() {
    this.socketio.disconnect();
    this.socketio.connect();
  }

  getPlayersInLobby() {
    const others = this.gameData?.otherPlayers;
    const us = this.gameData?.playerName;

    if (!(others && us)) return undefined;

    return [...others, us];
  }

  getOurScore() {
    return this.gameData!.gameState!.ourScore;
  }
}

export default WTTPClient;
