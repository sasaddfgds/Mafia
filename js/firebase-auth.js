import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, onSnapshot, getDocs, collection, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- БАЗЫ ДАННЫХ ДЛЯ СЦЕНАРИЕВ ---
export const introScenarios = [
    // Профессии базовые
    "Я скромный пекарь, всё утро пёк хлеб для города. Запах дрожжей — мой аромат.",
    "Я местный библиотекарь, обожаю тишину и старые книги. Знаю, кто какие книги берёт.",
    "Я кузнец, весь день работал в кузнице, руки в саже. Ковал подкову для мэра лично.",
    "Я заезжий торговец специями, ищу здесь новые знакомства. Перец чили у меня — огонь!",
    "Я врач, лечу людей и всегда готов прийти на помощь. Вчера ночью кого-то лечил... странный случай.",
    "Я садовник из поместья на холме, стриг кусты. Розы цветут прекрасно в этом году.",
    "Я учитель в местной школе, очень люблю детей. Дети болтают много интересного.",
    "Я моряк, только вчера сошел с корабля в ваш порт. Расскажу про призрачный фрегат.",
    "Я лесничий, знаю каждый куст в лесу за городом. Видел вчера странные следы...",
    "Я художник, приехал сюда за вдохновением и пейзажами. Пишу закат над старым заводом.",
    "Я плотник, помогал чинить забор у мэрии. Видел, кто заходил в задний вход ночью.",
    "Я простой почтальон, разношу письма по утрам. Читаю адреса, но не содержимое. Почти.",
    "Я аптекарь, знаю всё о целебных травах. Многие приходят за снотворным в полночь.",
    "Я часовщик, люблю точность и тиканье механизмов. Время — враг, но я его приручил.",
    "Я швея, шью лучшие костюмы в этом районе. Мэр носит мои пуговицы на пальто.",
    "Я пастух, весь день провел на пастбище с овцами. Овцы тихие, не как эти жители.",
    "Я повар из ресторана, сегодня готовил жаркое. Мясо — свежее, говорят мясник.",
    "Я инженер, приехал проверить городские мосты. Мосты надёжны, я проверял трижды.",
    "Я студент, изучаю историю этого старого города. Нашёл странные записи о 1923...",
    "Я музыкант, играю на скрипке на площади. Вчера ночью слышал странную мелодию в лесу.",
    // Дополнительные профессии
    "Я кладовщик на складе у реки. Знаю, что привозят ночью в закрытых фургонах.",
    "Я фуд-блогер, приехал снимать местную кухню. Где тут есть тайные кафе?",
    "Я криптозоолог. Изучаю слухи о 'Городском Болотном Человеке'. Пока ничего... живого.",
    "Я вдовец, живу в доме у озера. Жена утонула... сама. Я это докажу.",
    "Я приёмщик металлолома. Много ножей приносят последнее время. Острых.",
    "Я ночной бармен в забегаловке у дороги. Вижу, кто приходит с пятнами.",
    "Я патологоанатом в больнице. Знаю, как умирают естественно... и нет.",
    "Я охранник заброшенной фабрики. Слышу шаги в пустых цехах. Не хожу туда.",
    "Я детектив в отставке. Нюх не обманешь, а здесь пахнет кровью.",
    "Я новый владелец старого отеля. Гости жалуются на стук в стенах. Я тоже слышу."
];

export const alibiScenarios = [
    // Бытовые отмазки
    "Я всю ночь чинил сломанный кран на кухне. Вода хлюпала до утра.",
    "У меня жуткая бессонница, смотрел сериалы. Третий сезон 'Мёртвого озера'.",
    "Вчера была тяжелая смена, спал как убитый. Даже не слышал тишины.",
    "Гулял с собакой поздно вечером в парке. Собака лаяла на что-то в кустах.",
    "Всю ночь играл в видеоигры в наушниках. Рейд проходил, не мог бросить.",
    "Готовил срочный отчет, выпил литр кофе. Руки до сих пор трясутся.",
    "Я отравился, всю ночь просидел в уборной. Подозреваю молоко.",
    "У меня был романтический ужин до утра. Свечи, вино... потом сон.",
    "Пытался собрать шкаф, разозлился и бросил. Инструкция — на китайском.",
    "Всю ночь читал увлекательный детектив. Думал, я тоже смог бы раскрыть.",
    "Сидел в наушниках и сводил новый музыкальный бит. Бас громкий — ничего не слышал.",
    "У меня вчера сорвало трубу, убирал воду. Кошка плавала в ванне.",
    "Был на дне рождения друга, вернулся поздно. Выпил... достаточно.",
    "Ночью у меня самое продуктивное время работы. Писал код до рассвета.",
    "Пытался убаюкать плачущего ребенка. Потом сам уснул с ним на руках.",
    "Смотрел марафон фильмов ужасов. В окно стучало — оказалось ветка.",
    "Переписывался с иностранными партнерами. Разница во времени — моя погибель.",
    "Медитировал почти всю ночь. Осознал пустоту бытия. И уснул.",
    "Купил приставку, играл до рассвета. Глаза красные, но душа довольна.",
    "Поссорился с женой, гулял по району один. Думал о жизни. И пил пиво.",
    // Абсурдные и смешные
    "Ночевал в гараже — ключ от дома провалился в решётку улицы. Пытался достать проволокой.",
    "Смотрел в окно на луну три часа. Думал о смысле бытия. Потом забыл, о чём думал.",
    "Тренировался в беззвучном крике. Соседи не жаловались, я проверял.",
    "Учил попугая говорить 'кто там'. Попугай молчит. Я тоже.",
    "Сортировал носки по цвету. Потом по текстуре. Потом просто плакал.",
    "Пытался вырастить бонсай из вишнёвой косточки. Песню пел ей.",
    "Ремонтировал старую кофеварку третий час. Пила как чай — без давления.",
    "Смотрел, как сохнет краска на стене. Цвет 'пепельная роза' — ложь, он серый.",
    "Считал кафельные плитки в ванной. 342. Или 343? Придётся пересчитать.",
    "Писал автобиографию. Остановился на третьей главе: 'Детство — мутное'.",
    // Мрачные и тревожные
    "Слышал крики с улицы, но не выходил. Здесь не принято вмешиваться.",
    "Видел в окно странную машину, которая час стояла на углу. Потом уехала.",
    "Ночью пришёл незнакомец, спрашивал дорогу к дому убитого. Я промолчал.",
    "Собака всю ночь скулила на цепи. Я её не выпускал. Может, знала что-то.",
    "Читал старые газеты про исчезновения 1998-го. Здесь это норма.",
    "Смотрел на соседа через шторы. Он тоже смотрел на меня. Никто не махнул.",
    "Кот принёс на порог мёртвую крысу. Я предпочёл не думать об этом.",
    "Будильник звенел в 3:33 каждую ночь. Я выключил. Он всё равно звенел.",
    "В подвале что-то стукало. Я заложил дверь книгами. Почему-то помогло.",
    "Снился один и тот же сон: кто-то стоит у изголовья. Просыпался — никого."
];

// Firebase Config
const firebaseConfig = {
    apiKey: "AIzaSyA4lPo1Q9Mk9V0dUhsFOYfumecHt19asPk",
    authDomain: "mafia-5f82b.firebaseapp.com",
    projectId: "mafia-5f82b",
    storageBucket: "mafia-5f82b.firebasestorage.app",
    messagingSenderId: "318958707760",
    appId: "1:318958707760:web:920d10e4e215bd8b58f9f5",
    measurementId: "G-GKL25JD5NZ"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Cleanup Functions
export async function cleanupOldRooms() {
    try {
        const roomsSnap = await getDocs(collection(db, 'rooms'));
        const now = Date.now();
        roomsSnap.forEach(docSnap => {
            const data = docSnap.data();
            if (data.createdAt && (now - data.createdAt > 12 * 60 * 60 * 1000)) {
                deleteDoc(doc(db, 'rooms', docSnap.id));
            }
        });
    } catch(e) {}
}

export async function cleanupSmallLobbies() {
    try {
        const roomsSnap = await getDocs(collection(db, 'rooms'));
        roomsSnap.forEach(docSnap => {
            const data = docSnap.data();
            if (data.phase === 'lobby' && (!data.players || data.players.length < 3)) {
                deleteDoc(doc(db, 'rooms', docSnap.id));
                console.log(`Deleted small lobby: ${docSnap.id} (${data.players?.length || 0} players)`);
            }
        });
    } catch(e) {
        console.error('Error cleaning up small lobbies:', e);
    }
}

export async function cleanupInactiveRooms() {
    try {
        const roomsSnap = await getDocs(collection(db, 'rooms'));
        const now = Date.now();
        roomsSnap.forEach(docSnap => {
            const data = docSnap.data();
            const lastActivity = data.turnEndTime || data.createdAt || 0;
            const inactiveTime = now - lastActivity;
            
            if (data.phase !== 'lobby' && data.phase !== 'waiting') {
                deleteDoc(doc(db, 'rooms', docSnap.id));
                console.log(`Deleted inactive game room: ${docSnap.id} (phase: ${data.phase})`);
            } else if (inactiveTime > 2 * 60 * 60 * 1000) {
                deleteDoc(doc(db, 'rooms', docSnap.id));
                console.log(`Deleted stale room: ${docSnap.id} (inactive for ${Math.round(inactiveTime/60000)} min)`);
            }
        });
    } catch(e) {
        console.error('Error cleaning up inactive rooms:', e);
    }
}

// Start cleanup intervals
setInterval(cleanupSmallLobbies, 60 * 60 * 1000);
cleanupSmallLobbies();
setInterval(cleanupInactiveRooms, 30 * 60 * 1000);
cleanupInactiveRooms();

// Room Management
export function getRoomRef(roomId) {
    return doc(db, 'rooms', roomId);
}

export async function fetchActiveRooms() {
    try {
        const roomsSnap = await getDocs(collection(db, 'rooms'));
        const rooms = [];
        roomsSnap.forEach(docSnap => {
            const data = docSnap.data();
            if (data.phase === 'lobby') {
                rooms.push({
                    id: docSnap.id,
                    playersCount: data.players?.length || 0,
                    ...data
                });
            }
        });
        renderActiveRooms(rooms);
    } catch (e) {
        console.error('Error fetching rooms:', e);
    }
}

function renderActiveRooms(rooms) {
    const container = document.getElementById('active-rooms-list');
    if (rooms.length === 0) {
        container.innerHTML = '<p class="text-[10px] text-zinc-700 text-center py-4 italic">Нет активных комнат</p>';
        return;
    }
    
    container.innerHTML = rooms.map(room => {
        const roomCode = room.id.replace('ROOM_', '');
        return `
            <div class="flex items-center justify-between p-3 bg-zinc-950/50 rounded-2xl border border-zinc-800/50">
                <div class="flex items-center gap-3">
                    <span class="text-lg">🏛️</span>
                    <div>
                        <p class="text-[11px] font-black text-zinc-400">${roomCode}</p>
                        <p class="text-[9px] text-zinc-600">${room.playersCount}/10 жителей</p>
                    </div>
                </div>
                <button onclick="joinRoom('${roomCode}')" class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-[9px] font-black uppercase text-zinc-300 transition-colors">
                    Войти
                </button>
            </div>
        `;
    }).join('');
}

// Auth Functions
window.toggleAuthMode = function() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    
    if (loginForm.classList.contains('hidden')) {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
    } else {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
    }
};

window.handleLogin = async function() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
        showToast("Введите email и пароль", "danger");
        return;
    }

    try {
        await signInWithEmailAndPassword(auth, email, password);
        showToast("Вход выполнен успешно", "success");
    } catch (error) {
        let errorMsg = "Ошибка входа";
        switch (error.code) {
            case 'auth/user-not-found':
                errorMsg = "Пользователь не найден";
                break;
            case 'auth/wrong-password':
                errorMsg = "Неверный пароль";
                break;
            case 'auth/invalid-email':
                errorMsg = "Некорректный email";
                break;
            case 'auth/too-many-requests':
                errorMsg = "Слишком много попыток. Попробуйте позже";
                break;
        }
        showToast(errorMsg, "danger");
    }
};

window.handleRegister = async function() {
    const username = document.getElementById('register-username').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;

    if (!username || !email || !password) {
        showToast("Заполните все поля", "danger");
        return;
    }

    if (password.length < 6) {
        showToast("Пароль должен быть минимум 6 символов", "danger");
        return;
    }

    if (password !== confirmPassword) {
        showToast("Пароли не совпадают", "danger");
        return;
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const userId = userCredential.user.uid;
        
        await setDoc(doc(db, 'users', userId), {
            username: username,
            email: email,
            createdAt: Date.now()
        });
        
        await updateProfile(userCredential.user, { displayName: username });
        
        window.currentUsername = username;
        showToast("Аккаунт создан", "success");
    } catch (error) {
        let errorMsg = "Ошибка регистрации";
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMsg = "Этот email уже используется";
                break;
            case 'auth/invalid-email':
                errorMsg = "Некорректный email";
                break;
            case 'auth/weak-password':
                errorMsg = "Слабый пароль (минимум 6 символов)";
                break;
        }
        showToast(errorMsg, "danger");
    }
};

window.handleLogout = async function() {
    try {
        await auth.signOut();
        window.currentUsername = null;
        showToast("Вы вышли из аккаунта", "info");
    } catch (e) {
        showToast("Ошибка выхода", "danger");
    }
};

window.handleJoinFromMainMenu = function() {
    const roomId = document.getElementById('main-menu-room-input').value.trim();
    if (!roomId) {
        showToast("Введите код комнаты", "danger");
        return;
    }
    window.joinRoom(roomId);
};

window.openSettings = function() {
    document.getElementById('settings-modal').classList.remove('hidden');
};

window.closeSettings = function() {
    document.getElementById('settings-modal').classList.add('hidden');
};

window.leaveRoom = function() {
    location.reload();
};

// Import showToast from game.js (circular dependency handled by window object)
function showToast(message, type = 'info') {
    if (window.showToast) {
        window.showToast(message, type);
    }
}
