# Third-party notices

SixHat Compass · 六帽规划 is an independent community plugin, not an official DeepSeek or de Bono product.

The runtime uses public host services and the React instance supplied by DeepSeek Harness. It does not bundle DeepSeek Harness, React, DS Bot, or community plugin implementation code. Development dependencies and their exact resolutions are in package-lock.json; their licenses remain in installed dependency packages.

Interface and architecture references reviewed:
- DeepSeek Harness, MIT: https://github.com/deepseek-ai/deepseek-harness (installed 0.2.0-rc.2).
- DS Bot, Apache-2.0: https://github.com/Fei2411/DeepSeek-Bot at ae63b45c0d0e75b5f59fc3042b5043761ee41391.
- dsh-group-chat, MIT: https://github.com/localSummer/dsh-group-chat at 41a01367cf041ec4b5b62571dcce5f46c10f290d (slot registration, client factory format, global model lookup, loopback API design).
- dsh-plugin-chatgroup, MIT: https://github.com/ccbot2026/dsh-plugin-chatgroup at 34c0b12679afe3aac6ced8f933fb1723dcc99943.

No official six-hat training materials are included. All role instructions in src/strategies.ts are newly written project prompts. Code reuse, if introduced later, must record the exact files and retain required copyright and license notices.
