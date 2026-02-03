import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyBeJCtncp2ePYPwdQjWmD8tognJIiUnl40",
    authDomain: "otf-bible-2026.firebaseapp.com",
    projectId: "otf-bible-2026",
    storageBucket: "otf-bible-2026.firebasestorage.app",
    messagingSenderId: "764497402440",
    appId: "1:764497402440:web:b9517a6120aa3105c0967d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Reading Plan Configuration (Same logic as plan.html)
const start = new Date(2026, 0, 5); // Jan 5th
const end = new Date(2026, 11, 24); // Dec 24th

// Sequence Data
const seq = [
    ["Genesis", 1, 11], ["Job", 1, 42], ["Genesis", 12, 50], ["Exodus", 1, 40],
    ["Leviticus", 1, 27], ["Numbers", 1, 36], ["Deuteronomy", 1, 34], ["Joshua", 1, 24],
    ["Judges", 1, 21], ["Ruth", 1, 4], ["1 Samuel", 1, 31], ["2 Samuel", 1, 24],
    ["1 Chronicles", 1, 29], ["1 Kings", 1, 11], ["Ecclesiastes", 1, 12], ["Song of Songs", 1, 8],
    ["1 Kings", 12, 22], ["2 Kings", 1, 25], ["2 Chronicles", 1, 36], ["Jonah", 1, 4],
    ["Amos", 1, 9], ["Hosea", 1, 14], ["Micah", 1, 7], ["Isaiah", 1, 66],
    ["Nahum", 1, 3], ["Zephaniah", 1, 3], ["Habakkuk", 1, 3], ["Joel", 1, 3],
    ["Obadiah", 1, 1], ["Jeremiah", 1, 52], ["Lamentations", 1, 5], ["Ezekiel", 1, 48],
    ["Daniel", 1, 12], ["Ezra", 1, 10], ["Nehemiah", 1, 13], ["Esther", 1, 10],
    ["Haggai", 1, 2], ["Zechariah", 1, 14], ["Malachi", 1, 4], ["Matthew", 1, 28],
    ["Mark", 1, 16], ["Luke", 1, 24], ["John", 1, 21], ["Acts", 1, 28],
    ["Galatians", 1, 6], ["1 Thessalonians", 1, 5], ["2 Thessalonians", 1, 3],
    ["1 Corinthians", 1, 16], ["2 Corinthians", 1, 13], ["Romans", 1, 16],
    ["Ephesians", 1, 6], ["Philippians", 1, 4], ["Colossians", 1, 4], ["Philemon", 1, 1],
    ["1 Timothy", 1, 6], ["Titus", 1, 3], ["2 Timothy", 1, 4], ["Hebrews", 1, 13],
    ["James", 1, 5], ["1 Peter", 1, 5], ["2 Peter", 1, 3], ["1 John", 1, 5],
    ["2 John", 1, 1], ["3 John", 1, 1], ["Jude", 1, 1], ["Revelation", 1, 22]
];

// App Logic
class BibleApp {
    constructor() {
        this.state = {
            completedDays: [],
            completedBooks: [],
            completedItems: {}
        };
        this.entries = [];
        this.user = null; // Current logged in user
        this.unsubscribe = null; // Firestore listener un-subscriber

        this.init();
    }

    init() {
        this.generatePlan();
        this.render(); // Render empty state first
        this.renderBooks();
        this.renderAuthUI();

        // Listen for Auth Changes
        onAuthStateChanged(auth, (user) => {
            if (user) {
                this.user = user;
                this.renderAuthUI();
                this.syncData(user.uid);
            } else {
                this.user = null;
                this.renderAuthUI();
                // Clear state on logout
                this.state = { completedDays: [], completedBooks: [], completedItems: {} };
                if (this.unsubscribe) this.unsubscribe();
                this.updateUI();
            }
        });
    }

    renderAuthUI() {
        // Inject Auth Button into Header if not exists
        let authContainer = document.getElementById('auth-container');
        if (!authContainer) {
            const header = document.querySelector('header');
            authContainer = document.createElement('div');
            authContainer.id = 'auth-container';
            authContainer.style.marginTop = '10px';
            authContainer.style.display = 'flex';
            authContainer.style.alignItems = 'center';
            authContainer.style.gap = '10px';
            header.appendChild(authContainer);
        }

        authContainer.innerHTML = '';

        if (this.user) {
            const span = document.createElement('span');
            span.textContent = `Signed in as ${this.user.email}`;
            span.style.fontSize = '13px';
            span.style.color = 'var(--muted)';

            const btn = document.createElement('button');
            btn.textContent = 'Sign Out';
            btn.onclick = () => signOut(auth);
            
            authContainer.appendChild(span);
            authContainer.appendChild(btn);
        } else {
            const btn = document.createElement('button');
            btn.textContent = 'Sign In with Google to Save Progress';
            btn.style.backgroundColor = '#4285F4';
            btn.style.color = 'white';
            btn.style.fontWeight = 'bold';
            btn.onclick = () => {
                signInWithPopup(auth, provider).catch((error) => {
                    console.error("Auth Error:", error);
                    if (error.code === 'auth/unauthorized-domain') {
                        alert("Login failed: This domain is not authorized. Please visit the official site.");
                    } else {
                        alert("Login failed: " + error.message);
                    }
                });
            };
            authContainer.appendChild(btn);
        }
    }

    syncData(uid) {
        const docRef = doc(db, "bible_progress", uid);
        
        // Realtime Listener
        this.unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (!data.completedItems) data.completedItems = {};
                this.state = data;
                console.log("Synced from cloud");
                this.updateUI();
            } else {
                console.log("New user, creating empty doc");
                // Optional: Write initial state immediately or wait for first interaction
                this.saveState(); 
            }
        }, (error) => {
            console.error("Firestore Error:", error);
        });
    }

    async saveState() {
        if (!this.user) return; // Don't save if not logged in

        try {
            const docRef = doc(db, "bible_progress", this.user.uid);
            await setDoc(docRef, this.state, { merge: true });
        } catch (e) {
            console.error("Save failed:", e);
        }
    }

    updateUI() {
        // Re-render only dynamic parts
        this.entries.forEach(entry => this.renderDay(entry.dayIndex));
        this.renderBooks();
        this.updateStats();
    }

    toggleItem(dayIndex, itemIndex) {
        if (!this.user) {
            alert("Please sign in to save your progress!");
            return;
        }

        const key = `d${dayIndex}_i${itemIndex}`;
        const isDone = !!this.state.completedItems[key];

        if (isDone) {
            delete this.state.completedItems[key];
        } else {
            this.state.completedItems[key] = true;
        }

        const entry = this.entries[dayIndex];
        const allDone = entry.lines.every((_, idx) => this.state.completedItems[`d${dayIndex}_i${idx}`]);

        const dayIdxInArr = this.state.completedDays.indexOf(dayIndex);
        if (allDone && dayIdxInArr === -1) {
            this.state.completedDays.push(dayIndex);
        } else if (!allDone && dayIdxInArr > -1) {
            this.state.completedDays.splice(dayIdxInArr, 1);
        }

        this.saveState(); // Auto-save to cloud
    }

    toggleDay(dayIndex) {
        if (!this.user) {
            alert("Please sign in to save your progress!");
            return;
        }

        const dayIdxInArr = this.state.completedDays.indexOf(dayIndex);
        const isCurrentlyDone = dayIdxInArr > -1;
        const entry = this.entries[dayIndex];

        if (isCurrentlyDone) {
            this.state.completedDays.splice(dayIdxInArr, 1);
            entry.lines.forEach((_, idx) => {
                delete this.state.completedItems[`d${dayIndex}_i${idx}`];
            });
        } else {
            this.state.completedDays.push(dayIndex);
            entry.lines.forEach((_, idx) => {
                this.state.completedItems[`d${dayIndex}_i${idx}`] = true;
            });
        }

        this.saveState(); // Auto-save to cloud
    }

    toggleBook(bookName) {
        if (!this.user) {
            alert("Please sign in to save your progress!");
            return;
        }

        const idx = this.state.completedBooks.indexOf(bookName);
        if (idx > -1) {
            this.state.completedBooks.splice(idx, 1);
        } else {
            this.state.completedBooks.push(bookName);
        }
        this.saveState(); // Auto-save to cloud
    }

    generatePlan() {
        const main = [];
        for (const [book, s, e] of seq) {
            for (let ch = s; ch <= e; ch++) main.push(`${book} ${ch}`);
        }

        const totalDays = Math.floor((end - start) / (24 * 3600 * 1000)) + 1;
        const readingDaysNeeded = Math.ceil(main.length / 3);
        
        const wisdom = [];
        while (wisdom.length < totalDays) {
            for (let i = 1; i <= 150; i++) wisdom.push(`Psalm ${i}`);
            for (let i = 1; i <= 31; i++) wisdom.push(`Proverbs ${i}`);
        }

        let ptr = 0;
        for (let day = 0; day < totalDays; day++) {
            const d = new Date(start.getTime() + day * 24 * 3600 * 1000);
            const lines = [];
            if (day < readingDaysNeeded) {
                for (let k = 0; k < 3 && ptr < main.length; k++, ptr++) lines.push(main[ptr]);
            } else {
                lines.push("Rest / Catch-up");
            }
            lines.push(wisdom[day]);
            this.entries.push({ dayIndex: day, date: d, lines });
        }
    }

    updateStats() {
        const count = this.state.completedDays.length;
        const total = this.entries.length;
        const pct = Math.round((count / total) * 100);

        const statsText = document.getElementById('stats-text');
        if (statsText) statsText.textContent = `${count} / ${total} Days (${pct}%)`;
        
        const progressFill = document.getElementById('progress-fill');
        if (progressFill) progressFill.style.width = `${pct}%`;
    }

    fmtDate(d) {
        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const date = d.getDate();
        const suffix = (date > 3 && date < 21) ? 'th' :
            (date % 10 === 1) ? 'st' :
                (date % 10 === 2) ? 'nd' :
                    (date % 10 === 3) ? 'rd' : 'th';
        return `${days[d.getDay()]} ${months[d.getMonth()]} ${date}${suffix}`;
    }

    render() {
        const container = document.getElementById('plan-container');
        if (!container) return;
        container.innerHTML = '';

        this.entries.forEach(entry => {
            const card = document.createElement('div');
            card.className = 'day-card';
            card.id = `day-${entry.dayIndex}`;

            const header = document.createElement('div');
            header.className = 'day-header';
            header.onclick = () => this.toggleDay(entry.dayIndex);

            const dateSpan = document.createElement('div');
            dateSpan.className = 'day-date';
            dateSpan.textContent = this.fmtDate(entry.date);

            const check = document.createElement('div');
            check.className = 'day-check';
            check.innerHTML = `<svg class="check-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>`;

            header.appendChild(dateSpan);
            header.appendChild(check);

            const ul = document.createElement('ul');
            ul.className = 'readings-list';

            entry.lines.forEach((line, idx) => {
                const li = document.createElement('li');
                li.className = 'reading-item';
                li.id = `d${entry.dayIndex}_i${idx}`;

                li.onclick = (e) => {
                    e.stopPropagation();
                    this.toggleItem(entry.dayIndex, idx);
                };

                let contentHTML = line;
                if (idx === entry.lines.length - 1) {
                    contentHTML = `${line} <span class="wisdom-tag">Wisdom</span>`;
                }

                li.innerHTML = `
                    <div class="item-check" data-checked="false"></div>
                    <span class="item-text">${contentHTML}</span>
                `;
                ul.appendChild(li);
            });

            card.appendChild(header);
            card.appendChild(ul);
            container.appendChild(card);

            // Set initial state
            this.renderDay(entry.dayIndex);
        });
    }

    renderDay(dayIndex) {
        const card = document.getElementById(`day-${dayIndex}`);
        if (!card) return;

        const isDayDone = this.state.completedDays.includes(dayIndex);
        if (isDayDone) {
            card.classList.add('completed');
        } else {
            card.classList.remove('completed');
        }

        // Update items
        const entry = this.entries[dayIndex];
        entry.lines.forEach((_, idx) => {
            const isItemDone = !!this.state.completedItems[`d${dayIndex}_i${idx}`];
            const li = document.getElementById(`d${dayIndex}_i${idx}`);
            if (li) {
                const check = li.querySelector('.item-check');
                if (check) {
                    if (isItemDone) {
                        check.classList.add('checked');
                        li.classList.add('item-completed');
                    } else {
                        check.classList.remove('checked');
                        li.classList.remove('item-completed');
                    }
                }
            }
        });
    }

    renderBooks() {
        const container = document.getElementById('book-checklist');
        if (!container) return;
        container.innerHTML = '';

        const uniqueBooks = ["Psalms", "Proverbs"];
        const seen = new Set(uniqueBooks);

        seq.forEach(([book]) => {
            if (!seen.has(book)) {
                uniqueBooks.push(book);
                seen.add(book);
            }
        });

        uniqueBooks.forEach(book => {
            const isChecked = this.state.completedBooks.includes(book);

            const item = document.createElement('div');
            item.className = `day-card ${isChecked ? 'completed' : ''}`;
            item.style.padding = '12px 16px';
            item.onclick = () => this.toggleBook(book);

            const flex = document.createElement('div');
            flex.style.display = 'flex';
            flex.style.justifyContent = 'space-between';
            flex.style.alignItems = 'center';

            const label = document.createElement('span');
            label.textContent = book;
            label.style.fontWeight = '500';

            const check = document.createElement('div');
            check.className = 'day-check';
            check.style.width = '20px';
            check.style.height = '20px';
            check.innerHTML = `<svg class="check-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>`;

            flex.appendChild(label);
            flex.appendChild(check);
            item.appendChild(flex);

            container.appendChild(item);
        });
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.app = new BibleApp();
});
