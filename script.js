// script.js

// グローバルな設定と状態
let pomodoroSettings = {
    workTime: 25, // 作業時間（分）
    breakTime: 5, // 休憩時間（分）
    themeColor: '#34495e', // テーマカラー
    alarmSoundDataUrl: null, // アラーム音のData URL
    completedPomodoros: 0 // 完了したポモドーロの回数
};

let currentPhase = 'work'; // 現在のフェーズ ('work' または 'break')
let timerEndTime = 0; // 現在のフェーズが終了するタイムスタンプ (ms)
let timeoutId = null; // setTimeoutのID
let isTimerRunning = false; // タイマーが実行中かどうかのフラグ
let alarmAudio = null; // Audioオブジェクト
let pausedTimeLeft = 0; // タイマー一時停止時の残り時間（秒）

// ============================================================================
// ダイアログ関連の関数
// ============================================================================

/**
 * カスタムダイアログを表示する関数
 * @param {string} title - ダイアログのタイトル
 * @param {string} bodyHtml - ダイアログの本文 (HTML文字列)
 * @param {string} b1Text - 最初のボタンのテキスト
 * @param {function} b1Callback - 最初のボタンがクリックされたときに実行される関数
 * @param {string} b2Text - 2番目のボタンのテキスト
 * @param {function} b2Callback - 2番目のボタンがクリックされたときに実行される関数
 */
function showDialog(title, bodyHtml, b1Text, b1Callback, b2Text, b2Callback) {
    const dialog = document.getElementById('diag');
    const dTitle = document.getElementById('dTitle');
    const dBody = document.getElementById('dBody');
    const db1 = document.getElementById('db1');
    const db2 = document.getElementById('db2');

    // 引数で受け取った内容を要素にセット
    dTitle.textContent = title;
    dBody.innerHTML = bodyHtml; // HTML文字列をセット
    db1.textContent = b1Text;
    db2.textContent = b2Text;

    // 既存のイベントリスナーを削除（重複登録防止のため）
    // cloneNode(true) を使用して、要素をクローンし、古いイベントリスナーを削除します。
    // その後、元の要素を置き換えることで、クリーンな状態にします。
    const oldDb1 = db1;
    const oldDb2 = db2;
    const newDb1 = oldDb1.cloneNode(true);
    const newDb2 = oldDb2.cloneNode(true);
    oldDb1.parentNode.replaceChild(newDb1, oldDb1);
    oldDb2.parentNode.replaceChild(newDb2, oldDb2);

    // 新しいボタン要素を取得
    const currentDb1 = document.getElementById('db1');
    const currentDb2 = document.getElementById('db2');

    // ボタンにイベントリスナーを設定
    currentDb1.addEventListener('click', () => {
        dialog.close(); // ダイアログを閉じる
        if (typeof b1Callback === 'function') {
            b1Callback(); // コールバック関数を実行
        }
    });

    currentDb2.addEventListener('click', () => {
        dialog.close(); // ダイアログを閉じる
        if (typeof b2Callback === 'function') {
            b2Callback(); // コールバック関数を実行
        }
    });

    // 2つ目のボタンが不要な場合は非表示にする
    if (b2Text === "") {
        currentDb2.style.display = 'none';
    } else {
        currentDb2.style.display = ''; // 表示に戻す
    }

    // ダイアログを表示
    dialog.showModal();
}

// ============================================================================
// 設定関連の関数
// ============================================================================

/**
 * 設定をlocalStorageから読み込む
 */
function loadSettings() {
    const savedSettings = localStorage.getItem('pomodoroSettings');
    if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        // 新しいプロパティが追加された場合に対応
        pomodoroSettings = { ...pomodoroSettings, ...parsedSettings };

        // アラーム音のData URLがあればAudioオブジェクトを生成
        if (pomodoroSettings.alarmSoundDataUrl) {
            alarmAudio = new Audio(pomodoroSettings.alarmSoundDataUrl);
        }
    }
    applyTheme(pomodoroSettings.themeColor); // テーマカラーを適用
}

/**
 * 設定をlocalStorageに保存する
 */
function saveSettings() {
    localStorage.setItem('pomodoroSettings', JSON.stringify(pomodoroSettings));
    applyTheme(pomodoroSettings.themeColor); // テーマカラーを適用
    // 設定変更をiframeに通知（home.htmlとtimer.htmlのbody色も変更するため）
    const iframe = document.querySelector('iframe');
    if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({
            type: 'applyTheme',
            color: pomodoroSettings.themeColor
        }, '*');
    }
    console.log("設定が保存されました:", pomodoroSettings);
}

/**
 * テーマカラーを適用する
 * @param {string} color - 適用する色コード
 */
function applyTheme(color) {
    document.body.style.backgroundColor = color;
}

/**
 * 設定ダイアログを表示する
 */
function showSettingsDialog() {
    const settingsBodyHtml = `
        <div class="dialog-content">
            <label for="workTimeInput">① 作業時間 (分):</label>
            <input type="number" id="workTimeInput" min="1" value="${pomodoroSettings.workTime}">

            <label for="breakTimeInput">② 休憩時間 (分):</label>
            <input type="number" id="breakTimeInput" min="1" value="${pomodoroSettings.breakTime}">

            <label for="themeColorInput">③ テーマカラー:</label>
            <input type="color" id="themeColorInput" value="${pomodoroSettings.themeColor}">

            <label for="alarmSoundInput">④ アラーム音を選択 (mp3/wav):</label>
            <input type="file" id="alarmSoundInput" accept=".mp3, .wav">
            <audio id="alarmPreview" controls style="width: 100%; margin-top: 10px; display: none;"></audio>
        </div>
    `;

    showDialog(
        "設定",
        settingsBodyHtml,
        "保存",
        () => { // 保存ボタンが押された時の処理
            const workTimeInput = document.getElementById('workTimeInput');
            const breakTimeInput = document.getElementById('breakTimeInput');
            const themeColorInput = document.getElementById('themeColorInput');
            const alarmSoundInput = document.getElementById('alarmSoundInput');

            pomodoroSettings.workTime = parseInt(workTimeInput.value);
            pomodoroSettings.breakTime = parseInt(breakTimeInput.value);
            pomodoroSettings.themeColor = themeColorInput.value;

            // アラーム音のファイルが選択された場合
            if (alarmSoundInput.files.length > 0) {
                const file = alarmSoundInput.files[0];
                const reader = new FileReader();
                reader.onload = (e) => {
                    // 既存のObject URLがあれば解放
                    if (pomodoroSettings.alarmSoundDataUrl && pomodoroSettings.alarmSoundDataUrl.startsWith('blob:')) {
                        URL.revokeObjectURL(pomodoroSettings.alarmSoundDataUrl);
                    }
                    pomodoroSettings.alarmSoundDataUrl = e.target.result; // Data URLとして保存
                    alarmAudio = new Audio(pomodoroSettings.alarmSoundDataUrl);
                    saveSettings(); // Data URLを保存してから設定を保存
                };
                reader.onerror = (error) => {
                    console.error("ファイル読み込みエラー:", error);
                    alertMessage("エラー", "アラーム音の読み込みに失敗しました。");
                };
                reader.readAsDataURL(file); // Data URLとして読み込む
            } else {
                saveSettings(); // ファイルが選択されていない場合はそのまま保存
            }
        },
        "キャンセル",
        () => { // キャンセルボタンが押された時の処理
            console.log("設定がキャンセルされました。");
            // キャンセル時は何も保存しない
        }
    );

    // ダイアログが表示された後に、アラーム音のプレビューを設定
    const alarmSoundInput = document.getElementById('alarmSoundInput');
    const alarmPreview = document.getElementById('alarmPreview');

    // 現在アラーム音が設定されていればプレビュー表示
    if (pomodoroSettings.alarmSoundDataUrl) {
        alarmPreview.src = pomodoroSettings.alarmSoundDataUrl;
        alarmPreview.style.display = 'block';
    }

    alarmSoundInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const fileURL = URL.createObjectURL(file);
            alarmPreview.src = fileURL;
            alarmPreview.style.display = 'block';
            // 注意: このURLは一時的なもので、保存時にData URLに変換する必要がある
        } else {
            alarmPreview.src = '';
            alarmPreview.style.display = 'none';
        }
    });
}

// ============================================================================
// iframeとの通信処理
// ============================================================================

/**
 * iframeからのメッセージを受信するハンドラ
 * @param {MessageEvent} event
 */
window.addEventListener('message', (event) => {
    // セキュリティのため、event.originを検証することが推奨されますが、
    // 今回はローカルファイルなので'*'を使用します。
    // if (event.origin !== "http://your-domain.com") return;

    const message = event.data;

    switch (message.type) {
        case 'openSettings':
            showSettingsDialog();
            break;
        case 'startTimer':
            // timer.htmlに切り替えてタイマーを開始
            document.querySelector('iframe').src = 'timer.html';
            currentPhase = 'work'; // 常に作業時間から開始
            isTimerRunning = false; // 初期状態は停止
            pausedTimeLeft = 0; // 新しいタイマー開始時は一時停止時間をリセット
            // iframeがロードされたらタイマー情報を送信
            document.querySelector('iframe').onload = () => {
                sendTimerStateToIframe();
            };
            break;
        case 'backToHome':
            // home.htmlに戻る前に確認ダイアログを表示
            handleBackToHome();
            break;
        case 'toggleTimer':
            // timer.htmlからのタイマー開始/一時停止要求
            if (isTimerRunning) {
                pauseCountdown();
            } else {
                startCountdown();
            }
            sendTimerStateToIframe(); // 状態をiframeに送信
            break;
        case 'requestTimerState':
            // timer.htmlがロードされた後、初期状態を要求してきた場合
            sendTimerStateToIframe();
            break;
        case 'openRecords': // 新しいケース：記録表示
            document.querySelector('iframe').src = 'record.html';
            document.querySelector('iframe').onload = () => {
                sendRecordDataToIframe();
            };
            break;
        case 'requestRecordData': // record.htmlがロードされた後、記録データを要求してきた場合
            sendRecordDataToIframe();
            break;
        default:
            console.log("不明なメッセージを受信:", message);
            break;
    }
});

/**
 * iframe (timer.html) に現在のタイマー状態を送信する
 */
function sendTimerStateToIframe() {
    const iframe = document.querySelector('iframe');
    if (iframe && iframe.contentWindow) {
        const timeLeft = Math.max(0, Math.ceil((timerEndTime - Date.now()) / 1000));
        iframe.contentWindow.postMessage({
            type: 'timerState',
            timeLeft: isTimerRunning ? timeLeft : pausedTimeLeft, // 実行中なら残り時間、停止中なら一時停止時の時間
            currentPhase: currentPhase,
            isTimerRunning: isTimerRunning,
            workTime: pomodoroSettings.workTime,
            breakTime: pomodoroSettings.breakTime
        }, '*');
    }
}

/**
 * iframe (record.html) に記録データを送信する
 */
function sendRecordDataToIframe() {
    const iframe = document.querySelector('iframe');
    if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({
            type: 'recordData',
            completedPomodoros: pomodoroSettings.completedPomodoros,
            themeColor: pomodoroSettings.themeColor
        }, '*');
    }
}

/**
 * ホーム画面に戻る際の処理（確認ダイアログを含む）
 */
function handleBackToHome() {
    if (isTimerRunning) {
        // タイマーが実行中の場合、確認ダイアログを表示
        alertMessage(
            "確認",
            "タイマーが実行中です。停止してホームに戻りますか？",
            "はい",
            () => { // 「はい」が押された場合
                clearTimeout(timeoutId); // タイマーを停止
                isTimerRunning = false;
                pausedTimeLeft = 0; // ホームに戻る際は一時停止時間もリセット
                document.querySelector('iframe').src = 'home.html'; // home.htmlに戻る
            },
            "いいえ",
            () => { // 「いいえ」が押された場合
                // 何もしない（タイマー画面に留まる）
                console.log("ホームに戻る操作がキャンセルされました。");
            }
        );
    } else {
        // タイマーが停止中の場合、直接ホームに戻る
        clearTimeout(timeoutId); // 念のためタイマーをクリア
        isTimerRunning = false;
        pausedTimeLeft = 0; // ホームに戻る際は一時停止時間もリセット
        document.querySelector('iframe').src = 'home.html';
    }
}


// ============================================================================
// タイマーロジック
// ============================================================================

/**
 * カウントダウンを開始/再開する
 */
function startCountdown() {
    if (isTimerRunning) return; // すでに実行中の場合は何もしない

    isTimerRunning = true;

    const durationSeconds = (currentPhase === 'work' ? pomodoroSettings.workTime : pomodoroSettings.breakTime) * 60;

    if (pausedTimeLeft > 0) {
        // 一時停止からの再開
        timerEndTime = Date.now() + pausedTimeLeft * 1000;
        pausedTimeLeft = 0; // 再開したら一時停止時間をリセット
    } else {
        // 新しいフェーズの開始
        timerEndTime = Date.now() + durationSeconds * 1000;
    }

    updateTimerDisplayAndScheduleNext(); // タイマー表示を更新し、次の更新をスケジュール
}

/**
 * カウントダウンを一時停止する
 */
function pauseCountdown() {
    clearTimeout(timeoutId); // スケジュールされた次の更新をキャンセル
    isTimerRunning = false;
    // 一時停止時の残り時間を正確に計算して保存
    pausedTimeLeft = Math.max(0, Math.ceil((timerEndTime - Date.now()) / 1000));
    sendTimerStateToIframe(); // 状態をiframeに送信
}

/**
 * タイマー表示を更新し、次の更新をスケジュールする
 */
function updateTimerDisplayAndScheduleNext() {
    const currentLeft = Math.max(0, Math.ceil((timerEndTime - Date.now()) / 1000));

    sendTimerStateToIframe(); // iframeに現在の残り時間を送信

    if (currentLeft <= 0) {
        // タイマーが終了した場合
        isTimerRunning = false;
        playAlarm(); // アラームを鳴らす

        // フェーズを切り替える
        if (currentPhase === 'work') {
            pomodoroSettings.completedPomodoros++; // 作業完了時にカウントを増やす
            saveSettings(); // 設定を保存
            currentPhase = 'break';
            alertMessage("休憩時間", `${pomodoroSettings.breakTime}分間の休憩です。`);
        } else {
            currentPhase = 'work';
            alertMessage("作業時間", `${pomodoroSettings.workTime}分間の作業時間です。`);
        }
        // 新しいフェーズでタイマーを再開
        startCountdown(); // 再帰的に次のフェーズを開始
    } else if (isTimerRunning) {
        // まだ時間があり、タイマーが実行中の場合、次の更新をスケジュール
        // 次の秒の変わり目までの時間を計算
        const delay = (timerEndTime - Date.now()) % 1000 || 1000;
        timeoutId = setTimeout(updateTimerDisplayAndScheduleNext, delay);
    }
}

/**
 * アラーム音を再生する
 */
function playAlarm() {
    if (alarmAudio) {
        alarmAudio.play().catch(e => console.error("アラーム音の再生に失敗:", e));
    } else {
        console.log("アラーム音は設定されていません。");
        // デフォルトのアラーム音を鳴らすか、ブラウザの通知を出すなど
    }
}

/**
 * カスタムアラートメッセージを表示する（alert()の代替）
 * @param {string} title - メッセージのタイトル
 * @param {string} message - メッセージ本文
 */
function alertMessage(title, message, b1Text = "OK", b1Callback = () => {}, b2Text = "", b2Callback = () => {}) {
    const alertBodyHtml = `<p style="text-align: center;">${message}</p>`;
    showDialog(
        title,
        alertBodyHtml,
        b1Text,
        b1Callback,
        b2Text,
        b2Callback
    );
}


// ============================================================================
// 初期化処理
// ============================================================================

// DOMContentLoaded イベントで初期化処理を実行
document.addEventListener('DOMContentLoaded', () => {
    loadSettings(); // 設定を読み込む
    // iframeの初期ソースを設定
    document.querySelector('iframe').src = 'home.html';
});
