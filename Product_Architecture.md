\# 2026 Goal Planner – Product Architecture

\#\# Overview  
본 문서는 \*\*2026 Goal Planner\*\*의 핵심 구조를 정의하는 Product Architecture이다.    
본 제품은 연간 목표를 구조화하는 시스템과, 이를 실행·운영하는 시스템을 명확히 분리하여 설계되었다.

\> ⚠️ 점선(→ → →)은 \*\*하위 개념이 아닌 시간 흐름(Time Flow)\*\* 을 의미한다.

\---

\#\# 1\. Goal Structuring

연간 목표를 사고 구조로 분해하는 영역이다.    
Execution System의 모든 항목은 이 영역에서 파생된다.

\#\#\# 1.1 Mandarat

만다라트 표를 이용한 목표 구조화 방식

\- \*\*Center: Yearly Goal\*\*  
  \- 연간 목표 (만다라트의 중심)

\- \*\*Strategy Axis (8)\*\*  
  \- 연간 목표를 달성하기 위한 8개의 전략 축  
  \- 고정된 구조

\- \*\*Action Ideas (64)\*\*  
  \- 전략 축을 실행으로 풀어낸 아이디어 목록  
  \- Execution System의 \*\*Source of execution items\*\*

\> Action Ideas는 Project / Task / Routine의 출발점이다.

\---

\#\# 2\. Execution System

Goal Structuring에서 도출된 목표를 실제 행동으로 옮기는 운영 시스템이다.

\---

\#\#\# 2.1 Execution Objects

실제로 관리·실행되는 객체 단위

\#\#\#\# Project  
\- \*\*Strategy unit derived from Mandarat\*\*  
\- 목표 달성을 위한 전략 실행 단위  
\- 모든 실행(Task / Routine)의 기준 컨텍스트

\#\#\#\# Task  
\- \*\*One-off execution item\*\*  
\- 한 번 실행하면 완료되는 원자적 행동 단위

\#\#\#\# Routine  
\- \*\*Repeated execution item\*\*  
\- 매일/매주 반복 수행되는 실행 항목

\> 모든 Task / Routine은 반드시 Project에 귀속된다.

\---

\#\#\# 2.2 Planning Cycle

실행을 시간 단위로 나누어 관리하는 흐름    
(계층 구조가 아닌 \*\*시간 흐름\*\*)

\- \*\*Monthly Focus\*\*  
  \- 이번 달에 집중할 Project 선택

\- \*\*Weekly Planning\*\*  
  \- 주간 실행 계획 수립  
  \- Task 우선순위 결정

\- \*\*Daily Execution\*\*  
  \- 오늘 실행할 Task / Routine 체크

\---

\#\#\# 2.3 Review Cycle

실행 결과를 점검하고 조정하는 피드백 루프

\- \*\*Weekly Review\*\*  
  \- 주간 실행 결과 회고  
  \- 다음 주 계획 조정

\---

\#\# 3\. Core Architectural Principles

\- Mandarat은 모든 실행의 \*\*Source\*\*이다.  
\- Project는 실행의 \*\*기준 축(Execution Context)\*\* 이다.  
\- Task / Routine은 실행의 \*\*최소 단위\*\*이다.  
\- Planning Cycle과 Review Cycle은 \*\*시간 흐름\*\*이며, 객체의 하위 개념이 아니다.  
\- Execution System은 Mandarat 완료 이후에만 활성화된다.

\---

\#\# 4\. MVP Scope Note

\- \*\*Included\*\*  
  \- Mandarat  
  \- Project  
  \- Task / Routine  
  \- Monthly Focus  
  \- Weekly Planning  
  \- Daily Execution  
  \- Weekly Review

\- \*\*Excluded\*\*  
  \- Monthly Review  
  \- 통계 대시보드  
  \- 다중 연간 목표  
  \- 외부 연동 및 자동 추천

\---

\#\# Summary

\> 2026 Goal Planner는    
\> 연간 목표를 만다라트로 구조화하고,    
\> 이를 Project 단위 실행과 주간 운영 시스템으로 연결하여    
\> 목표 달성을 실제 행동으로 관리하는 플래너이다.

