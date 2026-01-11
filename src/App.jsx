import { useGoogleLogin } from '@react-oauth/google';
import axios from 'axios';
import { useState, useMemo } from 'react';

function App() {
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      setMessages([]);
      try {
        const res = await axios.get(
          'https://www.googleapis.com/gmail/v1/users/me/messages?q=label:anywhere (subject:fatura OR subject:invoice OR subject:Spotify OR subject:Amazon OR subject:YouTube OR "siparişiniz onaylandı") -"GCM Yatırım"&maxResults=30',
          { headers: { Authorization: `Bearer ${tokenResponse.access_token}` } }
        );

        if (res.data.messages) {
          const details = [];
          for (const msg of res.data.messages) {
            try {
              const detail = await axios.get(`https://www.googleapis.com/gmail/v1/users/me/messages/${msg.id}`, {
                headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
              });
              details.push(detail.data);
              await new Promise(r => setTimeout(r, 100));
            } catch (e) { console.warn(e); }
          }
          setMessages(details);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    },
    scope: 'https://www.googleapis.com/auth/gmail.readonly',
  });

  // VERİ İŞLEME: Sadece en güncel abonelikleri tekil olarak al
  const subscriptionList = useMemo(() => {
    const uniqueSubs = {};

    messages.forEach((msg) => {
      const snippet = msg.snippet || "";
      const fromHeader = msg.payload.headers.find(h => h.name === 'From')?.value || "";
      const sourceName = fromHeader.split('<')[0].replace(/"/g, '').trim();
      const textToSearch = (snippet + " " + sourceName).toLowerCase();

      if (textToSearch.includes("gcm") || textToSearch.includes("yatirim")) return;

      let displayName = sourceName;
      let domain = "google.com";
      let amount = 0;

      // Servis Belirleme
      if (textToSearch.includes("youtube")) { displayName = "YouTube Premium"; domain = "youtube.com"; amount = 57.99; }
      else if (textToSearch.includes("spotify")) { displayName = "Spotify"; domain = "spotify.com"; amount = 59.99; }
      else if (textToSearch.includes("amazon") || textToSearch.includes("prime")) { displayName = "Amazon Prime"; domain = "amazon.com"; amount = 39.00; }
      else if (textToSearch.includes("netflix")) { displayName = "Netflix"; domain = "netflix.com"; amount = 149.99; }
      else if (textToSearch.includes("adobe")) { displayName = "Adobe CC"; domain = "adobe.com"; amount = 50.14; }
      else return; // Tanınmayanları ele

      // Mail içindeki gerçek tutarı bulmaya çalış (varsa güncelle)
      const match = snippet.match(/(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/);
      if (match) {
        const foundAmount = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
        if (foundAmount > 10 && foundAmount < 1000) amount = foundAmount;
      }

      const date = new Date(parseInt(msg.internalDate));

      // Eğer bu servis daha önce eklenmişse, sadece daha yeni olanı tut (Tekilleştirme)
      if (!uniqueSubs[displayName] || date > uniqueSubs[displayName].date) {
        uniqueSubs[displayName] = {
          name: displayName,
          logo: `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
          amount: amount,
          date: date
        };
      }
    });

    return Object.values(uniqueSubs).sort((a, b) => b.amount - a.amount);
  }, [messages]);

  const monthlyTotal = subscriptionList.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#ffffff', color: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', padding: '20px' }}>
      
      {/* Mobil Başlık */}
      <header style={{ textAlign: 'center', marginTop: '20px', marginBottom: '40px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', letterSpacing: '-0.5px' }}>Aboneliklerim</h1>
        <p style={{ color: '#888', fontSize: '14px' }}>Toplam {subscriptionList.length} aktif üyelik</p>
      </header>

      {/* Ana Buton */}
      <div style={{ position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)', width: '90%', zArray: 100 }}>
        <button 
          onClick={() => login()} 
          disabled={loading}
          style={{ 
            width: '100%', padding: '18px', backgroundColor: '#ffffff', color: '#000000', 
            border: 'none', borderRadius: '16px', fontWeight: '700', fontSize: '16px',
            boxShadow: '0 10px 20px rgba(255,255,255,0.1)', cursor: 'pointer'
          }}
        >
          {loading ? 'Mailler taranıyor...' : 'Listeyi Güncelle'}
        </button>
      </div>

      {/* Toplam Kartı */}
      {subscriptionList.length > 0 && (
        <div style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%)', padding: '25px', borderRadius: '24px', marginBottom: '30px', border: '1px solid #333', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', color: '#aaa', marginBottom: '5px' }}>Aylık Toplam Ödeme</div>
          <div style={{ fontSize: '36px', fontWeight: '800', color: '#fff' }}>{monthlyTotal.toFixed(2)} <span style={{fontSize: '18px'}}>TL</span></div>
        </div>
      )}

      {/* Abonelik Listesi */}
      <div style={{ paddingBottom: '100px' }}>
        {subscriptionList.map((sub) => (
          <div key={sub.name} style={{ display: 'flex', alignItems: 'center', backgroundColor: '#121212', padding: '16px', borderRadius: '20px', marginBottom: '12px', border: '1px solid #1f1f1f' }}>
            <img src={sub.logo} alt={sub.name} style={{ width: '48px', height: '48px', borderRadius: '12px', marginRight: '16px', backgroundColor: '#fff', padding: '2px' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: '600', fontSize: '16px' }}>{sub.name}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>Son ödeme: {sub.date.toLocaleDateString('tr-TR')}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: '700', fontSize: '16px' }}>{sub.amount.toFixed(2)} TL</div>
              <div style={{ fontSize: '10px', color: '#22c55e', fontWeight: '600' }}>AKTİF</div>
            </div>
          </div>
        ))}

        {!loading && subscriptionList.length === 0 && (
          <div style={{ textAlign: 'center', color: '#444', marginTop: '100px' }}>
            <p>Henüz analiz yapılmadı.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;