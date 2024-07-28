import json
import os
from typing import TypedDict


class ConfigJson(TypedDict):
    name: str
    """config name"""
    round_amt: int
    """amount of rounds"""
    round_len: int
    """length of each round"""
    inter_len: int
    """time between rounds where the scores are displayed"""


def read_config_file():
    our_path = os.path.dirname(os.path.abspath(__file__))
    with open(our_path + "/config.json") as file:
        j: list[ConfigJson] = json.load(file)

    return j


def get_config(name: str):
    """gets a configuration by its name"""
    file = read_config_file()
    return [x for x in file if x["name"] == name][0]
