import { auth, db, getRoomRef, fetchActiveRooms, introScenarios, alibiScenarios } from './firebase-auth.js';
import { doc, getDoc, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// State
export let state = {
    userId: null,
    roomID: null,
    game: null,
    unsubscribeSnapshot: null
};

let renderedHistoryCount = 0;
let showScenarioUI = false;
let lastPrivateToastKey = "";
let toastQueue = [];
let toastIsShowing = false;

// Toast System
window.showToast = function(message, type = 'info') {
    toastQueue.push({ message, type });
    processToastQueue();
};

function processToastQueue() {
    if (toastIsShowing || toastQueue.length === 0) return;

    toastIsShowing = true;
    const { message, type } = toastQueue.shift();
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');

    const variants = {
        info: { bg: "bg-zinc-900/95 border-zinc-700 text-zinc-200", icon: "🔔", title: "Событие" },
        phase: { bg: "bg-indigo-950/95 border-indigo-800 text-indigo-100 shadow-indigo-900/30", icon: "🌙", title: "Фаза" },
        success: { bg: "bg-green-950/95 border-green-800 text-green-200", icon: "✔", title: "Успех" },
        danger: { bg: "bg-red-950/95 border-red-800 text-red-200 shadow-red-900/30", icon: "💀", title: "Тревога" },
        special: { bg: "bg-purple-950/95 border-purple-800 text-purple-100", icon: "✨", title: "Важно" },
        private: { bg: "bg-amber-950/95 border-amber-800 text-amber-100 shadow-amber-900/30", icon: "🕵", title: "Лично Вам" }
    };

    const selected = variants[type] || variants.info;
    toast.className = `toast-notify px-5 py-4 rounded-2xl text-[11px] font-black border-2 ${selected.bg}`;
    toast.innerHTML = `
        <div class="flex items-start gap-3">
            <span class="text-base mt-[1px]">${selected.icon}</span>
            <div>
                <div class="toast-title">${selected.title}</div>
                <div class="uppercase tracking-widest leading-relaxed">${message}</div>
            </div>
        </div>
    `;
    
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.add('hide');

        setTimeout(() => {
            toast.remove();
            toastIsShowing = false;
            processToastQueue();
        }, 320);
    }, 3000);
}

// Game Functions
export async function init() {
    onAuthStateChanged(auth, async user => {
        if (user) {
            state.userId = user.uid;
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
                window.currentUsername = userDoc.data().username || user.displayName || 'Игрок';
            } else {
                window.currentUsername = user.displayName || 'Игрок';
            }
            
            document.getElementById('header-username').innerText = window.currentUsername;
            document.getElementById('user-header').classList.remove('hidden');
            document.getElementById('auth-section').classList.add('hidden');
            document.getElementById('main-menu-section').classList.remove('hidden');
            
            await fetchActiveRooms();
            
            document.getElementById('loading-overlay').classList.add('hidden');
        } else {
            document.getElementById('auth-section').classList.remove('hidden');
            document.getElementById('main-menu-section').classList.add('hidden');
            document.getElementById('user-header').classList.add('hidden');
            document.getElementById('loading-overlay').classList.add('hidden');
        }
    });

    setInterval(() => {
        if (!state.game || !['introduction', 'discussion', 'day', 'night'].includes(state.game.phase)) {
            document.getElementById('game-timer').innerText = '--:--';
            return;
        }

        const timeLeft = Math.max(0, Math.ceil((state.game.turnEndTime - Date.now()) / 1000));
        const isVote = state.game.phase === 'day';
        const isNightAction = state.game.phase === 'night';
        document.getElementById('game-timer').innerText = `${isVote ? 'ГОЛОС: ' : (isNightAction ? 'ДЕЙСТВИЕ: ' : 'РЕЧЬ: ')}${timeLeft}С`;
        
        if (timeLeft === 0) {
            const me = state.game.players.find(p => p.id === state.userId);
            if (isNightAction) {
                if (me && me.isAdmin && !window.nightTimeoutLock) {
                    window.nightTimeoutLock = true;
                    window.resolveNightTimeout(state.game);
                    setTimeout(() => window.nightTimeoutLock = false, 5000);
                }
            } else if (isVote) {
                if (me && me.isAdmin && !window.resolvingDayLock) {
                    window.resolvingDayLock = true;
                    window.resolveDay(state.game);
                    setTimeout(() => window.resolvingDayLock = false, 5000);
                }
            } else {
                const currentSpeaker = state.game.players[state.game.speakerIndex];
                if (currentSpeaker && currentSpeaker.id === state.userId && !window.speakerEndLock) {
                    window.speakerEndLock = true;
                    window.nextSpeaker();
                    setTimeout(() => window.speakerEndLock = false, 5000);
                }
            }
        }
    }, 1000);
}

window.joinRoom = async function(roomIdFromForm) {
    const name = window.currentUsername || 'Игрок';
    const rid = roomIdFromForm || document.getElementById('room-id-input')?.value?.trim();

    if (!rid) return showToast("Укажите код комнаты", "danger");
    
    state.roomID = 'ROOM_' + rid.toUpperCase();
    const docRef = getRoomRef(state.roomID);
    
    try {
        const docSnap = await getDoc(docRef);
        let gameData;

        if (docSnap.exists()) {
            gameData = docSnap.data();
            if (!gameData.players.find(p => p.id === state.userId)) {
                if (gameData.phase !== 'lobby') return showToast("Игра уже идет", "danger");
                gameData.players.push({
                    id: state.userId,
                    name: name,
                    isAdmin: false,
                    isAlive: true,
                    role: 'Житель'
                });
            }
        } else {
            gameData = {
                phase: 'lobby',
                players: [{
                    id: state.userId,
                    name: name,
                    isAdmin: true,
                    isAlive: true,
                    role: 'Житель'
                }],
                history: ["Комната создана. Город ожидает жителей."],
                actions: {},
                votes: {},
                speakerIndex: 0,
                turnEndTime: 0,
                createdAt: Date.now()
            };
        }

        await saveData(gameData);
        renderedHistoryCount = 0;
        lastPrivateToastKey = "";

        state.unsubscribeSnapshot = onSnapshot(docRef, snap => {
            if (snap.exists()) {
                state.game = snap.data();
                render();
            }
        });

        document.getElementById('auth-section').classList.add('hidden');
        document.getElementById('main-menu-section').classList.add('hidden');
        document.getElementById('room-controls').classList.remove('hidden');
        document.getElementById('display-room-id').innerText = rid.toUpperCase();

    } catch (e) {
        showToast("Ошибка сети", "danger");
    }
};

async function saveData(newGameData) {
    if (!auth.currentUser || !state.roomID) return;
    try {
        await setDoc(getRoomRef(state.roomID), newGameData);
    } catch (e) {
        console.error("Save Error:", e);
    }
}

function addHistory(game, message) {
    if (!game.history) game.history = [];
    if (game.history[game.history.length - 1] !== message) game.history.push(message);
}

function getNextNightRole(game) {
    const aliveRoles = new Set(game.players.filter(p => p.isAlive).map(p => p.role));
    if (aliveRoles.has('Мафия') && !game.actions['Мафия']) return 'Мафия';
    if (aliveRoles.has('Доктор') && !game.actions['Доктор']) return 'Доктор';
    if (aliveRoles.has('Детектив') && !game.actions['Детектив']) return 'Детектив';
    return null;
}

function announceNightStart(game) {
    addHistory(game, "Наступает ночь. Мирные жители спят.");
    const firstRole = getNextNightRole(game);
    if (firstRole) {
        addHistory(game, `Просыпается ${firstRole} и выбирает действие.`);
        game.turnEndTime = Date.now() + 60000;
    } else {
        addHistory(game, "Этой ночью никто не просыпается.");
        game.turnEndTime = 0;
    }
}

function detectToastTypeFromHistory(message) {
    const lower = message.toLowerCase();
    if (lower.includes('началась') || lower.includes('победил') || lower.includes('роли распределены')) return 'special';
    if (lower.includes('изгнан') || lower.includes('мертв') || lower.includes('кроваво') || lower.includes('пал')) return 'danger';
    if (lower.includes('ночь') || lower.includes('просыпается') || lower.includes('голосовать') || lower.includes('обсуждение')) return 'phase';
    return 'info';
}

function showPrivateToastOnce(key, message) {
    if (lastPrivateToastKey === key) return;
    lastPrivateToastKey = key;
    showToast(message, 'private');
}

function render() {
    if (!state.game) return;

    const me = state.game.players.find(p => p.id === state.userId);
    if (!me) return;

    const log = document.getElementById('game-log');
    if (renderedHistoryCount === 0 && state.game.history?.length) {
        log.innerHTML = state.game.history.map(msg => `
            <div class="flex gap-3 border-l-2 border-zinc-800 pl-4 py-1">
                <span class="text-zinc-700 font-black">#</span>
                <span class="leading-relaxed italic">${msg}</span>
            </div>
        `).join('');
        log.scrollTop = log.scrollHeight;
        renderedHistoryCount = state.game.history.length;
    } else if (state.game.history?.length > renderedHistoryCount) {
        const freshEntries = state.game.history.slice(renderedHistoryCount);
        freshEntries.forEach(msg => {
            log.innerHTML += `
                <div class="flex gap-3 border-l-2 border-zinc-800 pl-4 py-1 animate-reveal">
                    <span class="text-zinc-700 font-black">#</span>
                    <span class="leading-relaxed italic">${msg}</span>
                </div>
            `;
            showToast(msg, detectToastTypeFromHistory(msg));
        });
        log.scrollTop = log.scrollHeight;
        renderedHistoryCount = state.game.history.length;
    }

    if (state.game.phase === 'lobby') {
        document.getElementById('lobby-section').classList.remove('hidden');
        document.getElementById('game-section').classList.add('hidden');
        document.getElementById('action-panel').classList.add('hidden');

        document.getElementById('player-count').innerText = `${state.game.players.length}/10`;
        document.getElementById('admin-controls').classList.toggle('hidden', !me.isAdmin);
        
        document.getElementById('player-list').innerHTML = state.game.players.map(p => `
            <div class="bg-zinc-900/60 p-5 rounded-2xl border border-zinc-800/50 flex justify-between items-center">
                <span class="text-xs font-black ${p.id === state.userId ? 'text-red-500' : 'text-zinc-300'} tracking-widest">${p.name}</span>
                ${p.isAdmin ? '<span class="text-[8px] font-black bg-zinc-800 px-3 py-1 rounded text-zinc-500 uppercase">Мэр</span>' : ''}
            </div>
        `).join('');
    } else {
        document.getElementById('lobby-section').classList.add('hidden');
        document.getElementById('game-section').classList.remove('hidden');
        document.getElementById('action-panel').classList.remove('hidden');
        document.getElementById('action-panel').classList.remove('translate-y-full');
        
        document.getElementById('main-body').className = state.game.phase === 'night' 
            ? 'min-h-screen flex flex-col night-overlay' 
            : 'min-h-screen flex flex-col bg-zinc-950';

        const phaseTitles = {
            'introduction': 'Знакомство',
            'night': 'Ночь',
            'discussion': 'Обсуждение',
            'day': 'Суд Линча'
        };

        document.getElementById('phase-text').innerText = phaseTitles[state.game.phase] || state.game.phase;
        
        const indicator = document.getElementById('phase-indicator');
        if (state.game.phase === 'night') {
            indicator.className = "w-3 h-3 rounded-full shadow-[0_0_10px] bg-indigo-600 shadow-indigo-500/50";
        } else {
            indicator.className = "w-3 h-3 rounded-full shadow-[0_0_10px] bg-red-600 shadow-red-500/50";
        }

        document.getElementById('panel-role-name').innerText = me.role;
        document.getElementById('panel-status').innerText = me.isAlive ? 'В ИГРЕ' : 'МЕРТВ';
        document.getElementById('panel-status').className = `text-[10px] font-black px-3 py-1 rounded-lg border ${me.isAlive ? 'text-green-500 border-green-900/30' : 'text-red-500 border-red-900/30'}`;

        renderGrid(me);
        renderActions(me);
    }

    checkWins();
}

function renderGrid(me) {
    const grid = document.getElementById('game-grid');
    grid.innerHTML = state.game.players.map(p => {
        const isDead = !p.isAlive;
        const isSpeaker = (state.game.phase === 'introduction' || state.game.phase === 'discussion') && 
                         state.game.players[state.game.speakerIndex]?.id === p.id;
        
        return `
            <div class="player-card p-5 rounded-[2rem] ${isDead ? 'dead' : 'bg-zinc-900/40'} ${isSpeaker ? 'active' : ''}">
                <div class="flex justify-between items-start mb-2">
                    <span class="text-xs font-black ${p.id === state.userId ? 'text-red-500' : 'text-zinc-300'} tracking-widest">${p.name}</span>
                    ${isSpeaker ? '<span class="text-[8px] font-black bg-red-900/30 text-red-400 px-2 py-1 rounded animate-pulse">ГОВОРИТ</span>' : ''}
                </div>
                ${!isDead && p.id === state.userId ? `<div class="text-[10px] text-zinc-600 font-bold mt-2">${me.role}</div>` : ''}
                ${isDead ? '<div class="text-[10px] text-red-900 font-black mt-2 uppercase tracking-widest">МЁРТВ</div>' : ''}
            </div>
        `;
    }).join('');
}

function renderActions(me) {
    const container = document.getElementById('panel-actions');
    const instruct = document.getElementById('panel-instruction');
    container.innerHTML = '';

    if (!me.isAlive) {
        instruct.innerText = "Вы мертвы. Наблюдайте за развитием событий.";
        return;
    }

    // ЗНАКОМСТВО / ОБСУЖДЕНИЕ
    if (state.game.phase === 'introduction' || state.game.phase === 'discussion') {
        const currentSpeaker = state.game.players[state.game.speakerIndex];
        
        if (currentSpeaker?.id === state.userId) {
            // Показываем сценарий если это наш ход и мы еще не показали
            if (!showScenarioUI) {
                showScenarioUI = true;
                const scenarios = state.game.phase === 'introduction' ? introScenarios : alibiScenarios;
                const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
                
                const scenarioDiv = document.createElement('div');
                scenarioDiv.className = "bg-zinc-900/80 border border-zinc-700 p-4 rounded-xl mb-4 animate-reveal";
                scenarioDiv.innerHTML = `
                    <div class="text-[8px] uppercase text-zinc-500 font-black tracking-widest mb-2">${state.game.phase === 'introduction' ? 'Кем вы представляетесь?' : 'Ваша отмазка:'}</div>
                    <div class="text-[11px] text-zinc-300 font-bold leading-relaxed">${scenario}</div>
                `;
                container.appendChild(scenarioDiv);
            }
            
            instruct.innerText = "Ваша очередь говорить. У вас 60 секунд.";
            const btn = document.createElement('button');
            btn.className = "btn-action w-full py-4 bg-red-900 hover:bg-red-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest";
            btn.innerText = "Закончить речь";
            btn.onclick = () => window.nextSpeaker();
            container.appendChild(btn);
        } else {
            instruct.innerText = `Внимательно слушайте: ${currentSpeaker?.name}. Не перебивайте выступающего.`;
        }
    } 
    
    // НОЧНЫЕ ДЕЙСТВИЯ
    else if (state.game.phase === 'night') {
        const nextRole = getNextNightRole(state.game);
        const isSpecialRole = ['Мафия', 'Доктор', 'Детектив'].includes(me.role);

        if (isSpecialRole && nextRole) {
            if (me.role === nextRole) {
                showPrivateToastOnce(
                    `role-turn-${state.game.history.length}-${nextRole}`,
                    `Ваша очередь: ${nextRole}. У вас 60 секунд на действие.`
                );
            } else {
                showPrivateToastOnce(
                    `role-wait-${state.game.history.length}-${nextRole}`,
                    `Сейчас действует роль: ${nextRole}. Ожидайте своей очереди.`
                );
            }
        }

        if (me.role === nextRole) {
            instruct.innerText = me.role === 'Мафия' ? "Выберите жертву этой ночи:" : (me.role === 'Доктор' ? "Кого излечим сегодня?" : "Укажите на того, чью роль хотите узнать:");
            
            state.game.players.filter(p => p.isAlive).forEach(p => {
                const b = document.createElement('button');
                b.className = "btn-action w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest";
                b.innerText = p.name;
                b.onclick = () => window.act(p.id);
                container.appendChild(b);
            });
        } else {
            instruct.innerText = "Город спит. Слышны только далекие шаги в темноте...";
        }
    } 
    
    // ГОЛОСОВАНИЕ
    else if (state.game.phase === 'day') {
        if (state.game.votes[state.userId]) {
            instruct.innerText = "Ваш голос принят. Ожидание окончательного решения городского совета.";
        } else {
            instruct.innerText = "Выберите того, кто должен покинуть город навсегда:";
            state.game.players.filter(p => p.isAlive && p.id !== state.userId).forEach(p => {
                const b = document.createElement('button');
                b.className = "btn-action w-full py-3 bg-red-950/40 border border-red-900/20 text-red-200 rounded-xl text-[10px] font-black uppercase tracking-widest";
                b.innerText = p.name;
                b.onclick = () => window.act(p.id);
                container.appendChild(b);
            });

            const skipBtn = document.createElement('button');
            skipBtn.className = "btn-action w-full py-3 bg-zinc-900 text-zinc-500 rounded-xl text-[10px] font-black uppercase mt-2 tracking-widest";
            skipBtn.innerText = "Воздержаться";
            skipBtn.onclick = () => window.act('skip');
            container.appendChild(skipBtn);
        }
    }
}

window.act = async function(targetId) {
    let game = { ...state.game };
    const me = game.players.find(p => p.id === state.userId);
    
    if (game.phase === 'night') {
        game.actions[me.role] = targetId;
        showToast("Действие принято. Ожидайте следующий ход.", "private");
        
        if (me.role === 'Детектив') {
            const target = game.players.find(p => p.id === targetId);
            showToast(`${target.name} - ${target.role === 'Мафия' ? 'МАФИЯ!' : 'Мирный житель'}`, target.role === 'Мафия' ? 'danger' : 'success');
        }

        const nextRole = getNextNightRole(game);

        if (!nextRole) {
            resolveNight(game);
        } else {
            addHistory(game, `Просыпается ${nextRole} и выбирает действие.`);
            game.turnEndTime = Date.now() + 60000;
            await saveData(game);
        }
    } else if (game.phase === 'day') {
        game.votes[state.userId] = targetId;
        const aliveCount = game.players.filter(p => p.isAlive).length;
        if (Object.keys(game.votes).length >= aliveCount) {
            window.resolveDay(game);
        } else {
            await saveData(game);
        }
    }
};

function resolveNight(game) {
    const killerChoice = game.actions['Мафия'];
    const doctorChoice = game.actions['Доктор'];
    
    let killedPlayer = null;
    if (killerChoice && killerChoice !== 'timeout' && killerChoice !== doctorChoice) {
        killedPlayer = game.players.find(p => p.id === killerChoice);
        game.players = game.players.map(p => p.id === killerChoice ? { ...p, isAlive: false } : p);
    }

    if (killedPlayer) {
        addHistory(game, `Ночь прошла кроваво. Найден мертвым: ${killedPlayer.name}.`);
    } else {
        addHistory(game, "Ночь прошла на удивление спокойно. Жертв нет.");
    }

    game.phase = 'discussion';
    game.speakerIndex = 0;
    game.turnEndTime = Date.now() + 60000;
    game.actions = {};
    game.votes = {};
    addHistory(game, "Город просыпается. Начинается обсуждение.");
    saveData(game);
}

window.resolveNightTimeout = async function(game) {
    let updated = { ...game };
    updated.actions = { ...(updated.actions || {}) };
    const nextRole = getNextNightRole(updated);
    if (!nextRole) {
        resolveNight(updated);
        return;
    }

    updated.actions[nextRole] = 'timeout';
    addHistory(updated, `${nextRole} не успел сделать выбор за 60 секунд.`);

    const afterRole = getNextNightRole(updated);
    if (!afterRole) {
        resolveNight(updated);
    } else {
        addHistory(updated, `Просыпается ${afterRole} и выбирает действие.`);
        updated.turnEndTime = Date.now() + 60000;
        await saveData(updated);
    }
};

window.resolveDay = async function(game) {
    const voteCounts = {};
    Object.values(game.votes).forEach(id => {
        if (id !== 'skip') voteCounts[id] = (voteCounts[id] || 0) + 1;
    });

    let maxVotes = 0;
    let candidates = [];

    Object.keys(voteCounts).forEach(id => {
        if (voteCounts[id] > maxVotes) {
            maxVotes = voteCounts[id];
            candidates = [id];
        } else if (voteCounts[id] === maxVotes) {
            candidates.push(id);
        }
    });

    if (candidates.length === 1) {
        const target = game.players.find(p => p.id === candidates[0]);
        game.players = game.players.map(p => p.id === target.id ? { ...p, isAlive: false } : p);
        addHistory(game, `Городской суд вынес приговор. ${target.name} был изгнан. Его роль: ${target.role}.`);
    } else {
        addHistory(game, "Городской совет не пришел к единому мнению. Никто не был наказан.");
    }

    game.phase = 'night';
    game.actions = {};
    game.votes = {};
    announceNightStart(game);
    await saveData(game);
};

window.nextSpeaker = async function() {
    let game = { ...state.game };
    game.speakerIndex++;

    while (game.speakerIndex < game.players.length && !game.players[game.speakerIndex].isAlive) {
        game.speakerIndex++;
    }

    if (game.speakerIndex >= game.players.length) {
        if (game.phase === 'introduction') {
            game.phase = 'night';
            addHistory(game, "Знакомство окончено. Город погружается во тьму.");
            announceNightStart(game);
        } else {
            game.phase = 'day';
            game.turnEndTime = Date.now() + 120000;
            addHistory(game, "Обсуждение окончено. Время голосовать.");
        }
        game.actions = {};
        game.votes = {};
    } else {
        game.turnEndTime = Date.now() + 60000;
    }
    
    showScenarioUI = false;
    await saveData(game);
};

window.startGame = async function() {
    let game = { ...state.game };
    const roles = ['Мафия', 'Доктор', 'Детектив'];
    while(roles.length < game.players.length) roles.push('Житель');
    const shuffled = roles.sort(() => Math.random() - 0.5);

    game.players = game.players.map((p, i) => ({ ...p, role: shuffled[i], isAlive: true }));
    game.phase = 'introduction';
    game.speakerIndex = 0;
    game.turnEndTime = Date.now() + 60000;
    addHistory(game, "Игра началась! Роли распределены.");
    addHistory(game, "Город проснулся. Время знакомства!");
    await saveData(game);
};

function checkWins() {
    if (!state.game || state.game.phase === 'lobby' || document.getElementById('win-overlay').classList.contains('hidden') === false) return;
    const alive = state.game.players.filter(p => p.isAlive);
    const mafia = alive.filter(p => p.role === 'Мафия').length;
    const town = alive.length - mafia;

    if (mafia === 0) end("Город Победил", "Вся мафия была раскрыта и изгнана!");
    else if (mafia >= town) end("Мафия Победила", "Город пал под властью преступности.");
}

function end(t, d) {
    document.getElementById('win-title').innerText = t;
    document.getElementById('win-desc').innerText = d;
    document.getElementById('win-overlay').classList.remove('hidden');
}

window.resetGame = function() {
    location.reload();
};

// Initialize
init();
