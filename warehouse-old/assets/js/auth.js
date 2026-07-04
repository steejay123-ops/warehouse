// ====== LOGIN FUNCTIONS ======
function togglePassword() {
  const passInput = document.getElementById('password');
  const eyeIcon = document.getElementById('eye-icon');
  
  if (passInput.type === 'password') {
    passInput.type = 'text';
    eyeIcon.innerHTML = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>`;
  } else {
    passInput.type = 'password';
    eyeIcon.innerHTML = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>`;
  }
}

function handleLogin() {
  const user = document.getElementById('username').value.trim();
  const pass = document.getElementById('password').value;
  
  const btn = document.getElementById('login-btn');
  const btnText = document.getElementById('btn-text');
  const btnIcon = document.getElementById('btn-icon');
  const btnSpinner = document.getElementById('btn-spinner');
  const alertBox = document.getElementById('login-alert');
  
  btn.disabled = true;
  btn.style.opacity = '0.85';
  btnText.textContent = 'در حال ارتباط با سرور...';
  btnIcon.classList.add('hidden');
  btnSpinner.classList.remove('hidden');
  alertBox.classList.add('hidden');

  setTimeout(() => {
    btn.disabled = false;
    btn.style.opacity = '1';
    btnText.textContent = 'ورود به سامانه';
    btnIcon.classList.remove('hidden');
    btnSpinner.classList.add('hidden');

    const account = usersDatabase[user];

    if (account && account.password === pass) {
      const dept = account.role;
      appState.user = { username: user, department: dept };
      appState.unit = dept;
      
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('app-screen').classList.remove('hidden');
      document.getElementById('app-screen').classList.add('flex');
      
      document.getElementById('user-name-display').textContent = account.name;
      document.getElementById('active-unit-badge').textContent = getDeptLabel(dept);
      document.getElementById('user-role-display').textContent = getDeptLabel(dept);
      document.getElementById('user-avatar-display').textContent = account.avatar;
      document.getElementById('header-avatar-display').textContent = account.avatar;
      
      renderSidebar(dept);
      
      const allowedItems = NAV_ITEMS[dept] || NAV_ITEMS.admin;
      const defaultTab = allowedItems.some(item => item.id === 'dashboard') ? 'dashboard' : allowedItems[0].id;
      
      switchTab(defaultTab);
      showToast('success', 'ورود موفق. خوش آمدید، ' + getDeptLabel(dept));
    } else {
      alertBox.classList.remove('hidden');
      document.getElementById('login-alert-text').textContent = 'نام کاربری یا رمز عبور اشتباه است.';
    }
  }, 1500);
}

function logout() {
  document.getElementById('app-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('flex');
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-alert').classList.add('hidden');
}

function getDeptLabel(d) {
  return {admin:'مدیریت کل سیستم',management:'مدیر پروژه',execution:'واحد اجرایی',documents:'واحد مدارک',feeding:'واحد تغذیه MT'}[d]||d;
}