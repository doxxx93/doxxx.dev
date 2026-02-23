---
title: Open Contribution Jam 2024 참여기
authors: doxxx
tags: [ open-contribution-jam, open-source, open-contribution, Glues ]
date: 2024-11-23 19:47:57 +0900
image: https://cf.festa.io/img/2024-11-23/578a092e-8a55-43f7-8f6e-0da67d52ebb4.png
description: Open Contribution Jam 2024 행사 참여 후기와 Glues 프로젝트 기여 경험을 공유합니다.
---

![img.png](/img/blog/2024-11-23/img.webp)

Open Contribution Jam 2024에 다녀왔습니다.

<!-- truncate -->

## 행사 개요

Open Contribution Jam은 국내 오픈 소스 프로젝트 메인테이너들을 초대해 하루 동안 다양한 참가자들과 직접 소통하며 프로젝트에 기여할 수 있는 기회를 제공하는 행사입니다. 이번 행사에는 다음과 같은
연사분들과 메인테이너분들이 참여했습니다:

- 키노트 스피커로 엔씨소프트의 박구삼 님과 AIMMO의 김지호 님
- [Planetarium](https://github.com/planetarium), [Glues](https://github.com/gluesql/glues), [Fedify](https://github.com/dahlia/fedify), [daldalso](https://github.com/stars/JJoriping/lists/daldalso)
  등 다양한 오픈 소스 프로젝트의 메인테이너분들

## 나의 기여 활동

저는 이번 행사에서 Glues 프로젝트에 참여하여 두 가지 의미 있는 기여를 할 수 있었습니다:

1. 디렉토리 탐색 개선

- 디렉토리 브라우저에서 Enter 키를 이용한 토글 기능 추가
- 기존의 'l'키와 오른쪽 화살표 키와 동일한 동작을 Enter 키로도 가능하게 함
- 폴더 열기/닫기를 더욱 직관적으로 만듦

vim의 키 바인딩만이 아닌 일반적인 사용자들도 쉽게 사용할 수 있고, 직관적인 키 바인딩을 추가하여 사용자 경험을 향상시킬 수 있었습니다.

2. vim 키맵 도움말 개선

다른 참여자분이 Delete Mode 관련 기능(de, db 등의 단어 삭제 명령어)을 구현하시는 것을 돕는 과정에서, [e] 커맨드의 도움말에 부정확한 설명이 있음을 발견했습니다.

- [e] 커맨드의 설명을 더 정확하게 수정
- vim의 표준 동작과 일치하도록 문서 개선

![img_2.png](/img/blog/2024-11-23/img_2.png)

같이 작업하신분들 모두 1개 이상의 PR을 제출하고 성공적으로 머지되었습니다.

## 특별한 경험

또한 인상 깊었던 점은 나인크로니클 팀의 개발자분과의 대화였습니다.

[planetarium/terraforms](https://github.com/planetarium/terraforms) 저장소를 통해 실제 운영 중인 서비스의 내부 구조까지 살펴볼 수 있는 귀중한 기회였습니다.

## 럭키 드로우

오전 10시 시작 행사였지만, 9시에 일찍 도착해 무릎 담요를 받을 수 있었습니다.
행사 말미의 럭키 드로우에서 에어팟 4세대를 당첨되는 행운도 있었습니다.

![img_3.png](/img/blog/2024-11-23/img_3.webp)

## 마무리

이번 Open Contribution Jam을 통해 오픈 소스 협업의 진정한 가치를 경험할 수 있었습니다. 단순히 코드를 기여하는 것을 넘어서, 다른 참여자분들과의 활발한 소통을 통해 새로운 아이디어를 발견하고 함께
해결책을 찾아가는 과정이 특히 즐거웠습니다. 초기 단계인 Glues 프로젝트의 방향성을 메인테이너분과 함께 고민하고 논의할 수 있었던 것도 귀중한 경험이었습니다.

이러한 오프라인 기여 행사의 가장 큰 장점은 실시간으로 피드백을 주고받으며 더 나은 해결책을 찾을 수 있다는 점입니다. PR을 통한 비동기 소통과는 또 다른 즐거움이 있었고, 특히 다른 참여자의 작업을 돕는 과정에서
새로운 관점을 배울 수 있었습니다.

앞으로도 이런 오픈소스 기여 행사가 더 많이 열려서, 더 많은 개발자들이 오픈소스 프로젝트에 참여하고 협업의 즐거움을 경험할 수 있기를 희망합니다.
