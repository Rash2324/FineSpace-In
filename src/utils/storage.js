const STORAGE_KEY = 'fs_management_data';

const initialData = {
  clients: [],
  priceMaster: {
    hardware: [],
    materials: []
  },
  settings: {
    darkMode: false,
    currency: '₹'
  }
};

export const getDB = () => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : initialData;
};

export const saveDB = (data) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

// Client Actions
export const addClient = (client) => {
  const db = getDB();
  const newClient = {
    id: Date.now().toString(),
    ...client,
    projects: [],
    createdAt: new Date().toISOString()
  };
  db.clients.push(newClient);
  saveDB(db);
  return newClient;
};

export const getClients = () => getDB().clients;

export const deleteClient = (id) => {
  const db = getDB();
  db.clients = db.clients.filter(c => c.id !== id);
  saveDB(db);
};

// Project Section Actions
export const addProjectSection = (clientId, sectionName) => {
  const db = getDB();
  const clientIndex = db.clients.findIndex(c => c.id === clientId);
  if (clientIndex === -1) return;

  const newSection = {
    id: Date.now().toString(),
    name: sectionName,
    expenses: [],
    hardware: [],
    materials: [],
    createdAt: new Date().toISOString()
  };

  db.clients[clientIndex].projects.push(newSection);
  saveDB(db);
  return newSection;
};

// Entry Actions (Expenses, Hardware, Materials)
export const addEntry = (clientId, sectionId, type, entry) => {
  const db = getDB();
  const client = db.clients.find(c => c.id === clientId);
  const section = client?.projects.find(s => s.id === sectionId);
  
  if (section) {
    const newEntry = {
      id: Date.now().toString(),
      ...entry,
      createdAt: new Date().toISOString()
    };
    section[type].push(newEntry);
    saveDB(db);
    return newEntry;
  }
};

// Price Master Actions
export const updatePriceMaster = (type, item) => {
  const db = getDB();
  const index = db.priceMaster[type].findIndex(i => i.name === item.name);
  if (index > -1) {
    db.priceMaster[type][index] = { ...db.priceMaster[type][index], ...item, updatedAt: new Date().toISOString() };
  } else {
    db.priceMaster[type].push({ ...item, updatedAt: new Date().toISOString() });
  }
  saveDB(db);
};

export const getPriceFromMaster = (type, name) => {
  const db = getDB();
  return db.priceMaster[type].find(i => i.name === name);
};

// Backup & Restore
export const exportData = () => {
  const data = getDB();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fs_management_backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
};

export const importData = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        saveDB(data);
        resolve(data);
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsText(file);
  });
};
