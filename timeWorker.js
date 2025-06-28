// timerWorker.js
let timerInterval;
let currentTimeInSeconds;
let isRunning = false;
let isWorkPeriod = true; // true for work, false for break
let workTime, breakTime;

// メインスレッドからのメッセージをリッスン
self.onmessage = function(e) {
    const data = e.data;

    switch (data.command) {
        case 'start':
            if (!isRunning) {
                // 初回開始時またはリセット後の開始時
                if (data.initialTime) {
                    currentTimeInSeconds = data.initialTime;
                    isWorkPeriod = data.isWorkPeriod;
                    workTime = data.workTime;
                    breakTime = data.breakTime;
                }
                isRunning = true;
                startCountdown();
            }
            break;
        case 'pause':
            if (isRunning) {
                clearInterval(timerInterval);
                isRunning = false;
            }
            break;
        case 'reset':
            clearInterval(timerInterval);
            isRunning = false;
            isWorkPeriod = true;
            workTime = data.workTime;
            breakTime = data.breakTime;
            currentTimeInSeconds = workTime * 60;
            self.postMessage({
                type: 'update',
                time: currentTimeInSeconds,
                isWork: isWorkPeriod,
                isRunning: isRunning
            });
            break;
        case 'setTimes': // 設定変更時にタイマーの時間を更新
            workTime = data.workTime;
            breakTime = data.breakTime;
            // タイマーが実行中でない場合のみ、現在の時間を更新
            if (!isRunning && timerInterval === undefined) {
                currentTimeInSeconds = isWorkPeriod ? workTime * 60 : breakTime * 60;
                self.postMessage({
                    type: 'update',
                    time: currentTimeInSeconds,
                    isWork: isWorkPeriod,
                    isRunning: isRunning
                });
            }
            break;
    }
};

function startCountdown() {
    timerInterval = setInterval(() => {
        currentTimeInSeconds--;
        self.postMessage({
            type: 'update',
            time: currentTimeInSeconds,
            isWork: isWorkPeriod,
            isRunning: isRunning
        });

        if (currentTimeInSeconds <= 0) {
            clearInterval(timerInterval);
            self.postMessage({
                type: 'completed',
                periodType: isWorkPeriod ? 'work' : 'break',
                workTime: workTime,
                breakTime: breakTime
            });
            isRunning = false; // Set to false after completion
        }
    }, 1000);
}
