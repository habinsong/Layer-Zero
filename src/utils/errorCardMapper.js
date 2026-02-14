function createCard(title, causes, actions, prevention, quickActions = []) {
    return {
        title,
        causes: causes.slice(0, 3),
        actions: actions.slice(0, 3),
        prevention: prevention.slice(0, 2),
        quickActions: quickActions.slice(0, 3)
    };
}

const ERROR_PATTERNS = [
    {
        test: (m) => m.includes('not heating at expected rate') || m.includes('heater') && m.includes('not heating'),
        card: createCard(
            '히터 가열 속도 부족',
            ['히터 카트리지 출력 저하', '써미스터 접촉/배선 불량', '냉각팬 풍량 과다 또는 PID 불안정'],
            ['출력을 일시정지하고 배선/히터 고정 상태를 확인하세요.', '노즐/베드 PID 튜닝을 다시 실행하세요.', '냉각팬 세기와 덕트 방향을 점검하세요.'],
            ['재질별 예열 프로파일을 분리해 온도 변동을 줄이세요.', '장시간 출력 전 5분 예열 안정화 후 시작하세요.'],
            [
                { label: 'PID 노즐', script: 'PID_CALIBRATE HEATER=extruder TARGET=220', confirm: true },
                { label: 'PID 베드', script: 'PID_CALIBRATE HEATER=heater_bed TARGET=60', confirm: true }
            ]
        )
    },
    {
        test: (m) => m.includes('extrude below minimum temp'),
        card: createCard(
            '저온 압출 차단',
            ['노즐 목표 온도 도달 전 압출 명령 실행', '시작 매크로 순서 문제', 'min_extrude_temp 설정이 높음'],
            ['노즐 온도 도달 후 압출 명령이 실행되도록 매크로 순서를 수정하세요.', '예열 완료를 확인한 뒤 수동 압출을 실행하세요.', '필요하면 min_extrude_temp 값을 점검하세요.'],
            ['PRINT_START에서 온도 대기(M109/M190) 단계를 고정하세요.', '재질별 시작 스크립트를 분리 운용하세요.'],
            [
                { label: '노즐 220도', script: 'SET_HEATER_TEMPERATURE HEATER=extruder TARGET=220' },
                { label: '베드 60도', script: 'SET_HEATER_TEMPERATURE HEATER=heater_bed TARGET=60' }
            ]
        )
    },
    {
        test: (m) => m.includes('move out of range'),
        card: createCard(
            '작업 범위 초과 이동',
            ['홈 이전 좌표 이동', 'slicer 시작점/오프셋 설정 오류', 'position_min/max 설정 불일치'],
            ['G28 수행 후 이동되도록 시작 G-code를 수정하세요.', '모델 시작 좌표와 베드 크기 설정을 다시 확인하세요.', 'Klipper 축 제한값(position_min/max)을 검토하세요.'],
            ['좌표계 보정 후 테스트 큐브를 먼저 출력하세요.', '프로파일 변경 시 시작 G-code를 함께 검증하세요.'],
            [
                { label: 'G28 홈', script: 'G28', confirm: true }
            ]
        )
    },
    {
        test: (m) => m.includes('must home axis first'),
        card: createCard(
            '홈 미실행 상태 이동',
            ['홈(G28) 누락', '재시작 후 이전 좌표 사용', '매크로에서 홈 단계 건너뜀'],
            ['먼저 G28 실행 후 이동/출력을 시작하세요.', '시작 매크로에 G28을 강제 포함하세요.', '비상정지/리셋 후 재출력 절차를 표준화하세요.'],
            ['출력 시작 전 체크리스트에 홈 완료 여부를 넣으세요.', '자동 시작 매크로를 단일화하세요.'],
            [
                { label: 'G28 홈', script: 'G28', confirm: true }
            ]
        )
    },
    {
        test: (m) => m.includes('no trigger on') || m.includes('still triggered after retract'),
        card: createCard(
            '엔드스톱/프로브 트리거 이상',
            ['엔드스톱 배선 또는 핀 로직 반전', '스위치 기구 간섭/고착', '프로브 물리 오프셋 문제'],
            ['엔드스톱 상태 조회로 입력 변화를 확인하세요.', '배선과 pin 설정(^, !, pullup)을 점검하세요.', '프로브 장착 위치와 스트로크를 재점검하세요.'],
            ['축별 홈 테스트를 정기적으로 수행하세요.', '진동으로 인한 커넥터 풀림을 방지하세요.'],
            [
                { label: 'G28 홈', script: 'G28', confirm: true }
            ]
        )
    },
    {
        test: (m) => m.includes('adc out of range'),
        card: createCard(
            '온도 센서 범위 이탈',
            ['써미스터 단선/합선', 'sensor_type 설정 불일치', '핀/풀업 설정 오류'],
            ['프린터를 정지하고 센서 배선을 즉시 점검하세요.', 'Klipper sensor_type/pin/pullup 설정을 확인하세요.', '센서 교체 후 온도 상승 테스트를 수행하세요.'],
            ['온도 그래프 급변 감시를 활성화하세요.', '정비 시 센서 커넥터 체결 상태를 확인하세요.'],
            [
                { label: '일시정지', script: 'PAUSE', confirm: true },
                { label: '팬 30%', script: 'M106 S77' }
            ]
        )
    },
    {
        test: (m) => m.includes('timer too close') || m.includes('communication timeout during homing'),
        card: createCard(
            '통신/스케줄 지연',
            ['호스트 과부하', 'USB/Wi-Fi 불안정', '전원 품질 저하'],
            ['불필요한 프로세스/탭을 줄여 호스트 부하를 낮추세요.', '케이블/전원 어댑터 상태를 점검하세요.', '연결 불안정 시 재부팅 후 재연결하세요.'],
            ['폴링 주기를 절전 프리셋으로 조정하세요.', '장시간 출력 시 전원/발열 환경을 안정화하세요.'],
            [
                { label: '일시정지', script: 'PAUSE', confirm: true }
            ]
        )
    },
    {
        test: (m) => m.includes('move exceeds maximum extrusion') || m.includes('extrude only move too long'),
        card: createCard(
            '압출량 제한 초과',
            ['유량/라인폭/레이어높이 조합 과다', '과도한 purge/retract', '노즐/필라멘트 파라미터 불일치'],
            ['슬라이서 유량/라인폭/노즐 직경을 재확인하세요.', '압출-only 거리와 purge 길이를 줄이세요.', '필라멘트 직경 입력값을 점검하세요.'],
            ['재질 프로파일별 유량 캘리브레이션을 저장하세요.', '시작 purge 길이를 최소화하세요.'],
            [
                { label: '유량 95%', script: 'M221 S95' },
                { label: '속도 90%', script: 'M220 S90' }
            ]
        )
    }
];

export function mapAlertToErrorCard(alert) {
    if (!alert?.message) return alert;

    const normalized = String(alert.message).toLowerCase();
    const matched = ERROR_PATTERNS.find((rule) => rule.test(normalized));
    if (!matched) {
        return {
            ...alert,
            card: createCard(
                '원인 분석 필요',
                ['로그 원문만으로 즉시 단정하기 어려운 상태입니다.'],
                ['최근 콘솔 로그를 확인하세요.', '출력 일시정지 후 온도/위치/팬 상태를 점검하세요.'],
                ['같은 메시지가 반복되면 설정/하드웨어 점검 이력을 남기세요.'],
                [{ label: '일시정지', script: 'PAUSE', confirm: true }]
            )
        };
    }

    return { ...alert, card: matched.card };
}
