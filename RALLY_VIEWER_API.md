# PerfectSwing Rally Viewer - 개발자용 웹 도구 API 문서

개발자가 앱 없이 웹에서 videoID 기반으로 랠리 추출 결과를 확인할 수 있는 도구 구현 가이드입니다.

---

## 1. API 정보

### Base URL
```
https://amexdqbnpothyfzgepoo.supabase.co
```

### Authentication
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtZXhkcWJucG90aHlmemdlcG9vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5MzI3NzEsImV4cCI6MjA2OTUwODc3MX0.CU18utHYTEsYNI_vRwS9VRsDS4NyiLKZ6-PkElzfH3s
```

---

## 2. 랠리 분석 결과 조회 API

### Endpoint
```
POST https://amexdqbnpothyfzgepoo.supabase.co/functions/v1/multipart-upload
```

### Headers
```
Content-Type: application/json
Authorization: Bearer <SUPABASE_ANON_KEY>
```

### Request Body
```json
{
  "action": "get-analysis",
  "videoId": "<VIDEO_ID>"
}
```

### Response (성공 - completed)
```json
{
  "videoId": "abc123-def456",
  "status": "completed",
  "videoUrl": "https://pub-xxx.r2.dev/original-videos/abc123-def456.mp4",
  "rallies": [
    {
      "rallyIndex": 0,
      "startTime": 5.2,
      "endTime": 12.8,
      "duration": 7.6
    },
    {
      "rallyIndex": 1,
      "startTime": 18.5,
      "endTime": 25.1,
      "duration": 6.6
    }
  ],
  "createdAt": "2025-01-15T10:30:00Z",
  "updatedAt": "2025-01-15T10:35:00Z"
}
```

### Response (처리 중)
```json
{
  "videoId": "abc123-def456",
  "status": "processing",
  "rallies": []
}
```

### Response (실패)
```json
{
  "videoId": "abc123-def456",
  "status": "failed",
  "rallies": [],
  "error": "Video analysis failed: corrupted file"
}
```

### Status 값
| Status | 설명 |
|--------|------|
| `pending` | 분석 대기 중 |
| `processing` | AI 분석 진행 중 |
| `completed` | 분석 완료 (rallies 배열에 데이터 있음) |
| `failed` | 분석 실패 (error 필드에 이유) |

---

## 3. curl 예시

### 분석 결과 조회
```bash
curl -X POST 'https://amexdqbnpothyfzgepoo.supabase.co/functions/v1/multipart-upload' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtZXhkcWJucG90aHlmemdlcG9vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5MzI3NzEsImV4cCI6MjA2OTUwODc3MX0.CU18utHYTEsYNI_vRwS9VRsDS4NyiLKZ6-PkElzfH3s' \
  -d '{"action": "get-analysis", "videoId": "YOUR_VIDEO_ID"}'
```

---

## 4. 웹 도구 구현 예시 (HTML + JavaScript)

아래 코드를 `rally-viewer.html`로 저장하고 브라우저에서 열면 바로 사용 가능합니다.

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PerfectSwing Rally Viewer</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #000;
      color: #fff;
      padding: 20px;
      max-width: 1200px;
      margin: 0 auto;
    }
    h1 { color: #C6F82A; }
    .input-group {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
    }
    input {
      flex: 1;
      padding: 12px 16px;
      font-size: 16px;
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 8px;
      color: #fff;
    }
    button {
      padding: 12px 24px;
      background: #C6F82A;
      color: #000;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
    }
    button:hover { background: #d4ff4a; }
    button:disabled { background: #666; cursor: not-allowed; }
    .status {
      padding: 8px 16px;
      border-radius: 20px;
      display: inline-block;
      font-size: 14px;
      font-weight: 600;
    }
    .status.completed { background: #C6F82A; color: #000; }
    .status.processing { background: #ffc107; color: #000; }
    .status.failed { background: #ff4444; color: #fff; }
    .status.pending { background: #888; color: #fff; }
    .video-container {
      margin: 20px 0;
      background: #1a1a1a;
      border-radius: 12px;
      overflow: hidden;
    }
    video {
      width: 100%;
      max-height: 500px;
    }
    .rally-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 12px;
      margin-top: 20px;
    }
    .rally-item {
      background: #1a1a1a;
      padding: 16px;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .rally-item:hover { background: #2a2a2a; }
    .rally-item.active {
      border: 2px solid #C6F82A;
      background: #1a2a1a;
    }
    .rally-index {
      font-size: 24px;
      font-weight: 700;
      color: #C6F82A;
    }
    .rally-time {
      color: #999;
      font-size: 14px;
      margin-top: 4px;
    }
    .error { color: #ff4444; margin: 20px 0; }
    .json-view {
      background: #1a1a1a;
      padding: 16px;
      border-radius: 12px;
      overflow-x: auto;
      font-family: monospace;
      font-size: 12px;
      margin-top: 20px;
      white-space: pre-wrap;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <h1>PerfectSwing Rally Viewer</h1>

  <div class="input-group">
    <input type="text" id="videoId" placeholder="Video ID를 입력하세요 (예: abc123-def456)">
    <button onclick="fetchAnalysis()" id="fetchBtn">조회</button>
  </div>

  <div id="result"></div>

  <script>
    const SUPABASE_URL = 'https://amexdqbnpothyfzgepoo.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtZXhkcWJucG90aHlmemdlcG9vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5MzI3NzEsImV4cCI6MjA2OTUwODc3MX0.CU18utHYTEsYNI_vRwS9VRsDS4NyiLKZ6-PkElzfH3s';

    let video = null;
    let currentRally = null;
    let rallies = [];

    async function fetchAnalysis() {
      const videoId = document.getElementById('videoId').value.trim();
      if (!videoId) {
        alert('Video ID를 입력하세요');
        return;
      }

      const btn = document.getElementById('fetchBtn');
      btn.disabled = true;
      btn.textContent = '조회 중...';

      try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/multipart-upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            action: 'get-analysis',
            videoId: videoId
          })
        });

        const data = await response.json();
        renderResult(data);
      } catch (error) {
        document.getElementById('result').innerHTML = `
          <div class="error">오류 발생: ${error.message}</div>
        `;
      } finally {
        btn.disabled = false;
        btn.textContent = '조회';
      }
    }

    function renderResult(data) {
      rallies = data.rallies || [];

      let html = `
        <div style="margin-bottom: 20px;">
          <strong>Video ID:</strong> ${data.videoId}<br>
          <strong>Status:</strong> <span class="status ${data.status}">${data.status}</span>
        </div>
      `;

      if (data.error) {
        html += `<div class="error">Error: ${data.error}</div>`;
      }

      if (data.videoUrl) {
        html += `
          <div class="video-container">
            <video id="videoPlayer" controls>
              <source src="${data.videoUrl}" type="video/mp4">
            </video>
          </div>
        `;
      }

      if (rallies.length > 0) {
        html += `<h3>랠리 목록 (${rallies.length}개)</h3>`;
        html += '<div class="rally-list">';
        rallies.forEach((rally, idx) => {
          html += `
            <div class="rally-item" onclick="playRally(${idx})" id="rally-${idx}">
              <div class="rally-index">#${rally.rallyIndex + 1}</div>
              <div class="rally-time">
                ${formatTime(rally.startTime)} - ${formatTime(rally.endTime)}
              </div>
              <div class="rally-time">
                Duration: ${rally.duration.toFixed(1)}s
              </div>
            </div>
          `;
        });
        html += '</div>';
      }

      html += `
        <h3>Raw JSON Response</h3>
        <div class="json-view">${JSON.stringify(data, null, 2)}</div>
      `;

      document.getElementById('result').innerHTML = html;

      // 비디오 이벤트 리스너 등록
      setTimeout(() => {
        video = document.getElementById('videoPlayer');
        if (video) {
          video.addEventListener('timeupdate', onTimeUpdate);
        }
      }, 100);
    }

    function formatTime(seconds) {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    function playRally(index) {
      if (!video || !rallies[index]) return;

      currentRally = rallies[index];
      video.currentTime = currentRally.startTime;
      video.play();

      // UI 업데이트
      document.querySelectorAll('.rally-item').forEach(el => el.classList.remove('active'));
      document.getElementById(`rally-${index}`).classList.add('active');
    }

    function onTimeUpdate() {
      if (!currentRally || !video) return;

      // 현재 랠리 종료 시점 체크
      if (video.currentTime >= currentRally.endTime) {
        const nextIndex = rallies.findIndex(r => r.rallyIndex === currentRally.rallyIndex + 1);
        if (nextIndex !== -1) {
          playRally(nextIndex);
        } else {
          video.pause();
          currentRally = null;
        }
      }
    }

    // Enter 키로 조회
    document.getElementById('videoId').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') fetchAnalysis();
    });
  </script>
</body>
</html>
```

---

## 5. 비디오 URL 직접 접근

분석 완료 시 `videoUrl` 필드에 R2/S3 public URL이 포함됩니다:

```
https://pub-xxx.r2.dev/original-videos/{videoId}.mp4
```

이 URL로 직접 비디오에 접근할 수 있습니다.

---

## 6. Rally 데이터 구조

| 필드 | 타입 | 설명 |
|------|------|------|
| `rallyIndex` | int | 랠리 번호 (0부터 시작) |
| `startTime` | double | 시작 시간 (초) |
| `endTime` | double | 종료 시간 (초) |
| `duration` | double | 길이 (초) |

---

## 7. 사용 시나리오

### 테스트 영상 업로드 후 결과 확인
1. 앱에서 영상 업로드
2. 콘솔 로그나 DB에서 videoId 확인
3. 웹 도구에서 videoId 입력 → 분석 결과 확인

### 분석 상태 모니터링
- `processing` → 폴링 필요 (수초~수분 소요)
- `completed` → 랠리 재생 가능
- `failed` → error 메시지 확인

### 디버깅
- 타임스탬프가 정확한지 비디오와 함께 확인
- Raw JSON으로 서버 응답 검증

---

## 8. 주의사항

- `SUPABASE_ANON_KEY`는 public key이므로 클라이언트에서 사용 가능
- 하지만 이 도구는 개발자 전용이므로 public 배포하지 않음
- 분석 중인 영상은 `status: processing` 반환 → 폴링 필요
