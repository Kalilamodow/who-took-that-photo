import { View } from "react-native";
import c from "../../ComponentAliases";
import WTTPClient from "../../WTTPClient";
import LoadingScreen from "./Loading";
import RoundView from "./Round";

import { Bar as ProgressBar } from "react-native-progress";

import { useEffect, useState } from "react";

enum GameViewState {
  Loading = "loading",
  Round = "round",
  AnswerChosen = "answer chosen",
  RoundResults = "round results",
  GameOver = "results",
}

const ScoreList = ({
  list,
}: {
  list: Array<{ name: string; score: number }>;
}) => (
  <c.List
    data={list.map(({ name, score }) => `${name}: ${score}`)}
    keyExtractor={item => `${item}${Math.random()}`}
  />
);

function Game({ client }: { client: WTTPClient }) {
  const [viewState, setViewState] = useState<GameViewState>(
    GameViewState.Loading,
  );

  const currentChoices = useState<string[]>([]);
  const currentImage = useState("");
  const [currentScores, setCurrentScores] = useState<
    Record<string, number>
  >({});

  const [timeLeftInRound, setTimeLeftInRound] = useState(-1);

  const ourAnswer = useState<string>("");
  const ourName = useState<string>("");
  const [ourScore, setOurScore] = useState(0);

  const gameConfig = useState<{
    rounds: number;
    roundLength: number;
  }>({ rounds: 0, roundLength: 0 });

  useEffect(() => {
    if (client.gameData) ourName[1](client.gameData.playerName);

    const timeTickSub = client.addListener(
      "game:timeLeftInRound",
      timeLeft => setTimeLeftInRound(timeLeft),
    );

    const roundStartSub = client.addListener(
      "game:roundStart",
      async (image, choices) => {
        currentImage[1](image);
        currentChoices[1]([...choices]);
        setViewState(GameViewState.Round);
      },
    );

    const roundEndSub = client.addListener("game:roundOver", scores => {
      setCurrentScores(scores);
      setOurScore(client.getOurScore());

      setViewState(GameViewState.RoundResults);
    });

    const gameEndSub = client.addListener("game:gameOver", scores => {
      setCurrentScores(scores);
      setOurScore(client.getOurScore());

      setViewState(GameViewState.GameOver);
    });

    return () => {
      timeTickSub.remove();
      roundStartSub.remove();
      roundEndSub.remove();
      gameEndSub.remove();
    };
  }, [client]);

  useEffect(() => {
    gameConfig[1](client.getConfig());
  }, []);

  function sendChoice(name: string) {
    client.sendAnswer(name);
    ourAnswer[1](name);
    setViewState(GameViewState.AnswerChosen);
  }

  return viewState == GameViewState.Loading ? (
    <LoadingScreen otherPlayers={client.gameData?.otherPlayers || []} />
  ) : viewState == GameViewState.Round ? (
    <RoundView
      peopleChoices={currentChoices[0]}
      image={currentImage[0]}
      onPersonSelected={sendChoice}
    />
  ) : viewState == GameViewState.AnswerChosen ? (
    <View
      style={{
        display: "flex",
        flexDirection: "column",
        paddingTop: 15,
      }}>
      <c.Header4>Answer Chosen</c.Header4>
      <c.Header1>{ourAnswer[0]}</c.Header1>
      <View style={{ height: 20 }} />
      <c.Text>Current Score: {ourScore}</c.Text>
      {timeLeftInRound <= 9 && (
        <>
          <View style={{ height: 20 }} />
          <ProgressBar
            width={200}
            progress={1.0 - timeLeftInRound / gameConfig[0].roundLength}
          />
        </>
      )}
    </View>
  ) : viewState == GameViewState.RoundResults ? (
    <View
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        paddingTop: 15,
      }}>
      <c.Header1>
        Round {client.gameData?.gameState?.currentRound || "-2147483647"}/
        {gameConfig[0].rounds}- Results
      </c.Header1>
      <c.Header4>You: {ourScore}</c.Header4>
      <ScoreList
        list={Object.entries(currentScores)
          .map(([name, score]) => ({ name, score }))
          .filter(({ name }) => name != ourName[0])
          .sort((a, b) => b.score - a.score)}
      />
    </View>
  ) : viewState == GameViewState.GameOver ? (
    <View style={{ paddingTop: 15 }}>
      <c.Header1>Results</c.Header1>
      <ScoreList
        list={Object.entries(currentScores)
          .map(([name, score]) => ({ name, score }))
          .sort((a, b) => b.score - a.score)}
      />
    </View>
  ) : (
    <></>
  );
}

export default Game;
