#include "esp_camera.h"
#include <WiFi.h>
#include "esp_http_server.h"
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"
#include <esp_wifi.h>

// ==========================================
// 1. 사용자 설정 및 핀 정의
// ==========================================
const char* ssid = "";
const char* password = "";

#define FLASH_GPIO_NUM 4
#define FLASH_INTENSITY 60

// 카메라 핀 정의 (AI-THINKER 모델 기준)
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

// ==========================================
// 2. 촬영 핸들러 (지연/전송량 최적화)
// ==========================================
static esp_err_t capture_flash_handler(httpd_req_t *req) {
    uint32_t t0 = millis();

    // 플래시 ON
    ledcWrite(FLASH_GPIO_NUM, FLASH_INTENSITY);

    // (핵심) 플래시 켠 직후 첫 프레임은 이미 노출 중이었을 수 있으니 버립니다.
    camera_fb_t *tmp = esp_camera_fb_get();
    if (tmp) esp_camera_fb_return(tmp);

    // 아주 짧게만 여유(프레임 경계 넘어가게)
    // QVGA 기준 10~30ms 정도로도 체감 개선되는 경우가 많습니다.
    delay(20);

    // 두 번째 프레임이 “플래시 반영”될 확률이 매우 높습니다.
    uint32_t t1 = millis();
    camera_fb_t *fb = esp_camera_fb_get();

    // 프레임 확보 후 플래시 OFF
    ledcWrite(FLASH_GPIO_NUM, 0);

    if (!fb) {
        return httpd_resp_send_500(req);
    }

    httpd_resp_set_type(req, "image/jpeg");
    httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
    httpd_resp_set_hdr(req, "Cache-Control", "no-store");
    httpd_resp_set_hdr(req, "Connection", "keep-alive");

    esp_err_t res = httpd_resp_send(req, (const char *)fb->buf, fb->len);
    uint32_t t2 = millis();

    Serial.printf("[CAPTURE] pre=%lu, capture+send=%lu, len=%u, RSSI=%d\n",
                  (unsigned long)(t1 - t0),
                  (unsigned long)(t2 - t1),
                  (unsigned)fb->len,
                  WiFi.RSSI());

    esp_camera_fb_return(fb);
    return res;
}

// ==========================================
// 3. Wi-Fi 최적화 유틸
// ==========================================
static void apply_wifi_optimizations_after_connect() {
    // 전력절감(PS) 완전 비활성화: 약전계에서 지연 튐 감소
    WiFi.setSleep(false);
    esp_err_t e1 = esp_wifi_set_ps(WIFI_PS_NONE);

    // TX 파워 상향: 약전계에서 재전송 감소에 도움
    WiFi.setTxPower(WIFI_POWER_19_5dBm);

    // 11b 강제: 약전계에서 실효 전송 지연이 줄어드는 경우가 많음(내부용)
    esp_err_t e2 = esp_wifi_set_protocol(WIFI_IF_STA, WIFI_PROTOCOL_11B);

    Serial.printf("[WIFI OPT] ps_none=%s, proto_11b=%s\n",
                  (e1 == ESP_OK ? "OK" : "FAIL"),
                  (e2 == ESP_OK ? "OK" : "FAIL"));
}

// ==========================================
// 4. setup()
// ==========================================
void setup() {
    delay(100);

    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0); // 브라운아웃 방지
    Serial.begin(115200);
    Serial.setDebugOutput(false);

    // 플래시 PWM 설정 (사용자 코드 스타일 유지)
    ledcAttach(FLASH_GPIO_NUM, 5000, 8);
    ledcWrite(FLASH_GPIO_NUM, 0);

    // 카메라 설정 (내부용: 전송량/지연 최적화)
    camera_config_t config;
    config.ledc_channel = LEDC_CHANNEL_0;
    config.ledc_timer = LEDC_TIMER_0;
    config.pin_d0 = Y2_GPIO_NUM;
    config.pin_d1 = Y3_GPIO_NUM;
    config.pin_d2 = Y4_GPIO_NUM;
    config.pin_d3 = Y5_GPIO_NUM;
    config.pin_d4 = Y6_GPIO_NUM;
    config.pin_d5 = Y7_GPIO_NUM;
    config.pin_d6 = Y8_GPIO_NUM;
    config.pin_d7 = Y9_GPIO_NUM;
    config.pin_xclk = XCLK_GPIO_NUM;
    config.pin_pclk = PCLK_GPIO_NUM;
    config.pin_vsync = VSYNC_GPIO_NUM;
    config.pin_href = HREF_GPIO_NUM;
    config.pin_sscb_sda = SIOD_GPIO_NUM;
    config.pin_sscb_scl = SIOC_GPIO_NUM;
    config.pin_pwdn = PWDN_GPIO_NUM;
    config.pin_reset = RESET_GPIO_NUM;
    config.xclk_freq_hz = 20000000;
    config.pixel_format = PIXFORMAT_JPEG;

    // ===== 내부용 최적화 포인트 =====
    // 1) 프레임 크기 낮춰 전송 바이트 감소 (체감 가장 큼)
    config.frame_size = FRAMESIZE_QVGA;   // 320x240
    // 2) JPEG 품질 낮춰(숫자 ↑) 용량 감소
    config.jpeg_quality = 12;            // 10~15 범위에서 튜닝
    // 3) 프레임버퍼 1개로 큐 지연 줄이기
    config.fb_count = 1;
    // 4) 새 프레임 위주로 받기(지연 예측성 향상)
    config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;

    if (esp_camera_init(&config) != ESP_OK) {
        Serial.println("Camera init failed");
        return;
    }

    // (선택) 센서 추가 세팅: 필요 시 여기서 더 만질 수 있음
    // sensor_t *s = esp_camera_sensor_get();
    // s->set_framesize(s, FRAMESIZE_QVGA);
    // s->set_quality(s, 12);

    // Wi-Fi 연결 (내부용 최적화)
    WiFi.mode(WIFI_STA);
    WiFi.setAutoReconnect(true);
    WiFi.persistent(false);

    // 전력절감 OFF는 begin 전/후 모두 의미가 있으니 begin 전에도 한 번 적용
    WiFi.setSleep(false);

    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) {
        delay(250);
        Serial.print(".");
    }
    Serial.println();

    apply_wifi_optimizations_after_connect();

    Serial.println("======================================");
    Serial.println("   ESP32-CAM (챔버 내부용) 연결 성공!");
    Serial.println("======================================");
    Serial.print("로컬 IP 주소: ");
    Serial.println(WiFi.localIP());
    Serial.print("RSSI: ");
    Serial.println(WiFi.RSSI());
    Serial.println("--------------------------------------");

    // HTTP 서버 시작 (타임아웃/소켓 최적화)
    httpd_config_t server_config = HTTPD_DEFAULT_CONFIG();
    server_config.server_port = 80;
    server_config.lru_purge_enable = true;
    server_config.max_open_sockets = 4;
    server_config.recv_wait_timeout = 5; // 초
    server_config.send_wait_timeout = 5; // 초

    httpd_handle_t server = NULL;
    if (httpd_start(&server, &server_config) == ESP_OK) {
        httpd_uri_t capture_flash_uri = {
            .uri      = "/capture_flash",
            .method   = HTTP_GET,
            .handler  = capture_flash_handler,
            .user_ctx = NULL
        };
        httpd_register_uri_handler(server, &capture_flash_uri);

        Serial.print("카메라(플래시): http://");
        Serial.print(WiFi.localIP());
        Serial.println("/capture_flash");
        Serial.println("======================================");
    } else {
        Serial.println("HTTP server start failed");
    }
}

// ==========================================
// 5. loop()
// ==========================================
void loop() {
    delay(1);
}