async function loadROIData() {
  const urlParams = new URLSearchParams(window.location.search);
  const email = urlParams.get('email');

  if (!email) {
    showError('Missing email parameter. Please request a new access link.');
    return;
  }

  try {
    const response = await fetch(`/api/roi/ui?email=${encodeURIComponent(email)}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        showError('Your session has expired. Please request a new access link.');
      } else {
        throw new Error(data.error || 'Failed to load ROI data');
      }
      return;
    }

    displayROIData(data);
  } catch (error) {
    showError(`Error loading ROI data: ${error.message}`);
  }
}

function displayROIData(data) {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';

  document.getElementById('clientInfo').textContent = `${data.client.name} (${data.client.email})`;

  document.getElementById('billed12m').textContent = `$${data.metrics.billed_12m.toLocaleString()}`;
  document.getElementById('paid12m').textContent = `$${data.metrics.paid_12m.toLocaleString()}`;
  document.getElementById('onTimeRate').textContent = `${Math.round(data.metrics.on_time_rate * 100)}%`;
  document.getElementById('savingsVsList').textContent = `$${data.metrics.savings_vs_list.toLocaleString()}`;

  displayInvoices(data.recent_invoices);
  displayPayments(data.recent_payments);
  displayBenefits(data.benefits);
}

function displayInvoices(invoices) {
  const tbody = document.getElementById('invoicesTable');
  tbody.innerHTML = '';

  invoices.forEach((invoice) => {
    const row = tbody.insertRow();
    row.innerHTML = `
      <td>${invoice.number}</td>
      <td>${formatDate(invoice.date)}</td>
      <td>${formatDate(invoice.due_date)}</td>
      <td class="amount">$${invoice.amount.toLocaleString()}</td>
      <td><span class="status ${invoice.status}">${invoice.status}</span></td>
    `;
  });
}

function displayPayments(payments) {
  const tbody = document.getElementById('paymentsTable');
  tbody.innerHTML = '';

  payments.forEach((payment) => {
    const row = tbody.insertRow();
    row.innerHTML = `
      <td>${formatDate(payment.date)}</td>
      <td class="amount positive">$${payment.amount.toLocaleString()}</td>
      <td>${payment.method.replace('_', ' ')}</td>
      <td>${payment.applied_to}</td>
    `;
  });
}

function displayBenefits(benefits) {
  const container = document.getElementById('benefitsList');
  container.innerHTML = '';

  benefits.forEach((benefit) => {
    const card = document.createElement('div');
    card.className = 'benefit-card';

    const bulletsList = benefit.bullets.map((bullet) => `<li>${bullet}</li>`).join('');

    card.innerHTML = `
      <div class="benefit-title">${benefit.product_key}</div>
      <ul class="benefit-bullets">${bulletsList}</ul>
    `;

    container.appendChild(card);
  });
}

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return dateStr;
  }
}

function showError(message) {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('error').style.display = 'block';
  document.getElementById('error').textContent = message;
}

loadROIData();

