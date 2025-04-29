import { useState, useEffect } from 'react'
import { getRoomTypes } from '../services/dataService'
import { supabase } from '../supabaseClient'
import '../styles/Profile.css'

function Profile() {
  const [activeSection, setActiveSection] = useState('home')
  const [isMuted, setIsMuted] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [roomTypes, setRoomTypes] = useState([])
  const [bookingForm, setBookingForm] = useState({
    name: '',
    email: '',
    checkIn: '',
    checkOut: '',
    roomType: '',
    note: ''
  })
  const [totalPrice, setTotalPrice] = useState(0)
  const [roomPrice, setRoomPrice] = useState(0)
  const [availableRoom, setAvailableRoom] = useState(null)
  const [captchaText, setCaptchaText] = useState('')
  const [captchaInput, setCaptchaInput] = useState('')
  const [captchaError, setCaptchaError] = useState(false)
  const [audio, setAudio] = useState(null)
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    const fetchRoomTypes = async () => {
      try {
        const { data, error } = await supabase
          .from('room')
          .select('room_type')
          .order('room_type', { ascending: true })

        if (error) throw error
        
        // Remove duplicates and set room types
        const uniqueRoomTypes = [...new Set(data.map(room => room.room_type))]
        setRoomTypes(uniqueRoomTypes)
      } catch (error) {
        console.error('Error fetching room types:', error)
      }
    }
    fetchRoomTypes()
  }, [])

  // Fungsi untuk mencari kamar yang tersedia
  const findAvailableRoom = async (roomType, checkIn, checkOut) => {
    try {
      // Cari kamar dengan tipe yang sesuai
      const { data: rooms, error: roomsError } = await supabase
        .from('room')
        .select('room_number')
        .eq('room_type', roomType)

      if (roomsError) throw roomsError

      // Cari booking yang overlap dengan tanggal yang diminta
      const { data: bookings, error: bookingsError } = await supabase
        .from('booking')
        .select('room_number')
        .or(`check_in_date.lte.${checkOut},check_out_date.gte.${checkIn}`)

      if (bookingsError) throw bookingsError

      // Filter kamar yang tidak ada di daftar booking
      const bookedRoomNumbers = bookings.map(b => b.room_number)
      const availableRooms = rooms.filter(room => !bookedRoomNumbers.includes(room.room_number))

      return availableRooms[0]?.room_number || null
    } catch (error) {
      console.error('Error finding available room:', error)
      return null
    }
  }

  // Fungsi untuk mengambil harga kamar
  const fetchRoomPrice = async (roomType) => {
    try {
      const { data, error } = await supabase
        .from('price')
        .select('room_price')
        .eq('room_type', roomType)
        .single()

      if (error) throw error
      return data.room_price
    } catch (error) {
      console.error('Error fetching room price:', error)
      return 0
    }
  }

  // Update harga kamar saat tipe kamar berubah
  useEffect(() => {
    const updateRoomPrice = async () => {
      if (bookingForm.roomType) {
        const price = await fetchRoomPrice(bookingForm.roomType)
        setRoomPrice(price)
      }
    }
    updateRoomPrice()
  }, [bookingForm.roomType])

  // Update total harga saat durasi atau harga kamar berubah
  useEffect(() => {
    const calculateTotal = () => {
      if (bookingForm.checkIn && bookingForm.checkOut && roomPrice > 0) {
        const startDate = new Date(bookingForm.checkIn)
        const endDate = new Date(bookingForm.checkOut)
        const diffDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))
        const days = diffDays + 1 // Total hari termasuk check-in dan check-out
        const nights = diffDays // Jumlah malam = hari - 1
        const multiplier = nights <= 1 ? 1 : nights
        const total = roomPrice * multiplier
        
        console.log('Calculating total:', { 
          days,
          nights,
          multiplier,
          roomPrice,
          total
        })
        
        setTotalPrice(total)
      }
    }
    calculateTotal()
  }, [bookingForm.checkIn, bookingForm.checkOut, roomPrice])

  // Update total price dan cari kamar yang tersedia saat form berubah
  useEffect(() => {
    const updateBookingDetails = async () => {
      if (bookingForm.roomType && bookingForm.checkIn && bookingForm.checkOut) {
        const roomNumber = await findAvailableRoom(
          bookingForm.roomType,
          bookingForm.checkIn,
          bookingForm.checkOut
        )
        setAvailableRoom(roomNumber)
      }
    }
    updateBookingDetails()
  }, [bookingForm.roomType, bookingForm.checkIn, bookingForm.checkOut])

  const handleBookingSubmit = async (e) => {
    e.preventDefault()
    
    // Validasi captcha
    if (captchaInput.toLowerCase() !== captchaText.toLowerCase()) {
      setCaptchaError(true)
      generateCaptcha()
      return
    }

    if (!availableRoom) {
      alert('Maaf, tidak ada kamar yang tersedia untuk tanggal yang dipilih')
      return
    }

    try {
      // Insert data ke tabel booking
      const { data, error } = await supabase
        .from('booking')
        .insert([
          {
            guest_name: bookingForm.name,
            guest_email: bookingForm.email,
            room_number: availableRoom,
            room_type: bookingForm.roomType,
            check_in_date: bookingForm.checkIn,
            check_out_date: bookingForm.checkOut,
            room_price: roomPrice,
            total_price: totalPrice,
            guest_note: bookingForm.note,
            created_at: new Date().toISOString()
          }
        ])
        .select()

      if (error) throw error

      // Reset form setelah berhasil
      setBookingForm({
        name: '',
        email: '',
        checkIn: '',
        checkOut: '',
        roomType: '',
        note: ''
      })
      setTotalPrice(0)
      setRoomPrice(0)
      setAvailableRoom(null)
      generateCaptcha()
      alert('Booking berhasil!')
    } catch (error) {
      console.error('Error:', error)
      alert('Terjadi kesalahan. Silakan coba lagi.')
    }
  }

  const handleBookingChange = (e) => {
    const { name, value } = e.target
    setBookingForm(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleDateChange = (e) => {
    const { name, value } = e.target
    setBookingForm(prev => ({
      ...prev,
      [name]: value
    }))
  }

  useEffect(() => {
    const handleScroll = () => {
      const sections = ['home', 'rooms', 'facilities', 'booking', 'contact']
      const scrollPosition = window.scrollY + 100

      for (const section of sections) {
        const element = document.getElementById(section)
        if (element) {
          const { offsetTop, offsetHeight } = element
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveSection(section)
            break
          }
        }
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const audioElement = new Audio('https://raw.githubusercontent.com/hfzt07/dbweb/main/bali-backsound.mp3')
    audioElement.volume = 0.3
    audioElement.loop = true
    setAudio(audioElement)

    // Try to play the audio when user interacts with the page
    const playAudio = () => {
      audioElement.play().catch(error => {
        console.log('Autoplay prevented:', error)
      })
    }
    
    // Add event listeners for user interaction
    document.addEventListener('click', playAudio, { once: true })
    document.addEventListener('touchstart', playAudio, { once: true })
    
    // Try to play audio immediately
    playAudio()
    
    return () => {
      document.removeEventListener('click', playAudio)
      document.removeEventListener('touchstart', playAudio)
      audioElement.pause()
    }
  }, [])

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isMobileMenuOpen && !event.target.closest('.nav-links') && !event.target.closest('.mobile-menu')) {
        setIsMobileMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isMobileMenuOpen])

  useEffect(() => {
    // Load reCAPTCHA script
    const script = document.createElement('script')
    script.src = 'https://www.google.com/recaptcha/api.js'
    script.async = true
    script.defer = true
    document.head.appendChild(script)

    return () => {
      document.head.removeChild(script)
    }
  }, [])

  useEffect(() => {
    generateCaptcha()
  }, [])

  const generateCaptcha = () => {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    let captcha = ''
    for (let i = 0; i < 4; i++) {
      captcha += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setCaptchaText(captcha)
    setCaptchaInput('')
    setCaptchaError(false)
  }

  const scrollFacilities = (direction) => {
    const container = document.querySelector('.facilities-container');
    const cardWidth = document.querySelector('.facility-card').offsetWidth + 32; // 32px for gap
    const scrollAmount = cardWidth * 2; // Scroll 2 cards at a time
    
    if (container) {
      const start = container.scrollLeft;
      const target = direction === 'prev' ? start - scrollAmount : start + scrollAmount;
      
      const duration = 500; // Animation duration in ms
      const startTime = performance.now();
      
      function animate(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function for smooth animation
        const easeInOutCubic = progress => progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;
        
        const currentPosition = start + (target - start) * easeInOutCubic(progress);
        container.scrollLeft = currentPosition;
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      }
      
      requestAnimationFrame(animate);
    }
  };

  const toggleMute = () => {
    if (audio) {
      audio.muted = !audio.muted
      setIsMuted(!isMuted)
    }
  }

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  const handleMobileNavClick = (section) => {
    document.getElementById(section)?.scrollIntoView({ behavior: 'smooth' })
    setActiveSection(section)
    setIsMobileMenuOpen(false)
  }

  const handleContactChange = (e) => {
    const { name, value } = e.target;
    setContactForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSubmitSuccess(true);
      setContactForm({
        name: '',
        email: '',
        subject: '',
        message: ''
      });
      
      // Reset success message after 3 seconds
      setTimeout(() => {
        setSubmitSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('Error submitting contact form:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="app">
      <audio id="background-music" style={{ display: 'none' }}>
        <source src="https://raw.githubusercontent.com/hfzt07/dbweb/main/bali-backsound.mp3" type="audio/mpeg" />
      </audio>
      
      <button 
        className="music-control left" 
        onClick={toggleMute}
        aria-label={isMuted ? "Unmute music" : "Mute music"}
      >
        <i className={`fas fa-volume-${isMuted ? 'mute' : 'up'}`}></i>
      </button>

      <button 
        className="book-now-button"
        onClick={() => {
          document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' })
          setActiveSection('booking')
        }}
      >
        Book Now
      </button>

      <nav className="navbar">
        <div className="logo-container">
          <img src="https://raw.githubusercontent.com/hfzt07/dbweb/main/amanuba-logo.png" alt="Amanuba Hotel Logo" className="logo-img" />
          <h1 className="logo">Amanuba Hotel & Resort Rancamaya</h1>
        </div>
        <div className={`nav-links ${isMobileMenuOpen ? 'mobile' : ''}`}>
          <button 
            className={activeSection === 'home' ? 'active' : ''}
            onClick={() => handleMobileNavClick('home')}
          >
            Home
          </button>
          <button 
            className={activeSection === 'rooms' ? 'active' : ''}
            onClick={() => handleMobileNavClick('rooms')}
          >
            Rooms
          </button>
          <button 
            className={activeSection === 'facilities' ? 'active' : ''}
            onClick={() => handleMobileNavClick('facilities')}
          >
            Facilities
          </button>
          <button 
            className={activeSection === 'booking' ? 'active' : ''}
            onClick={() => handleMobileNavClick('booking')}
          >
            Book Now
          </button>
          <button 
            className={activeSection === 'contact' ? 'active' : ''}
            onClick={() => handleMobileNavClick('contact')}
          >
            Contact
          </button>
        </div>
        <button 
          className="mobile-menu" 
          onClick={toggleMobileMenu}
          aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
        >
          <i className={`fas fa-${isMobileMenuOpen ? 'times' : 'bars'}`}></i>
        </button>
      </nav>

      <section id="home" className="hero">
        <div className="hero-content">
          <h1>Welcome to Ubud Rancamaya</h1>
          <p>Experience luxury and comfort in the heart of Bogor's natural beauty</p>
          <button 
            className="cta-button"
            onClick={() => {
              document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' });
              setActiveSection('booking');
            }}
          >
            Book Now
          </button>
        </div>
      </section>

      <section id="rooms" className="rooms-section">
        <h2 className="section-title">Our Rooms</h2>
        <div className="rooms-container">
          <div className="room-card">
            <div className="room-image">
              <img src="https://raw.githubusercontent.com/hfzt07/dbweb/main/DeluxeRoom.png" alt="Deluxe Room" />
              <div className="room-overlay">
              </div>
            </div>
            <div className="room-info">
            <h3>Deluxe Room</h3>
            </div>
          </div>
          <div className="room-card">
            <div className="room-image">
              <img src="https://raw.githubusercontent.com/hfzt07/dbweb/main/SuperiorRoom.jpg" alt="Superior Room" />
              <div className="room-overlay">
              </div>
            </div>
            <div className="room-info">
            <h3>Superior Room</h3>
            </div>
          </div>
          <div className="room-card">
            <div className="room-image">
              <img src="https://raw.githubusercontent.com/hfzt07/dbweb/main/SuiteRoom.png" alt="Suite Room" />
              <div className="room-overlay">
              </div>
            </div>
            <div className="room-info">
            <h3>Suite Room</h3>
            </div>
          </div>
        </div>
      </section>

      <section id="meeting" className="meeting-section">
        <h2 className="section-title">Meeting & Events</h2>
        <div className="meeting-wrapper">
          <div className="meeting-grid">
            <div className="meeting-card">
              <div className="meeting-image">
                <img src="https://raw.githubusercontent.com/hfzt07/dbweb/main/AlamandaMeeting.webp" alt="Alamanda" />
                <div className="meeting-overlay">
                  <span className="meeting-capacity">Up to 50 people</span>
                </div>
              </div>
              <div className="meeting-info">
                <h3>Alamanda</h3>
                <p>Perfect for business meetings</p>
                <ul className="meeting-features">
                  <li><i className="fas fa-wifi"></i> High-speed WiFi</li>
                  <li><i className="fas fa-tv"></i> Projector & Screen</li>
                  <li><i className="fas fa-coffee"></i> Coffee Break</li>
                </ul>
              </div>
            </div>

            <div className="meeting-card">
              <div className="meeting-image">
                <img src="https://raw.githubusercontent.com/hfzt07/dbweb/main/EdelweissMeeting.JPG" alt="Edelweiss" />
                <div className="meeting-overlay">
                  <span className="meeting-capacity">Up to 200 people</span>
                </div>
              </div>
              <div className="meeting-info">
                <h3>Edelweiss</h3>
                <p>Ideal for weddings and large events</p>
                <ul className="meeting-features">
                  <li><i className="fas fa-music"></i> Sound System</li>
                  <li><i className="fas fa-lightbulb"></i> LED Lighting</li>
                  <li><i className="fas fa-utensils"></i> Catering Service</li>
                </ul>
              </div>
            </div>

            <div className="meeting-card">
              <div className="meeting-image">
                <img src="https://raw.githubusercontent.com/hfzt07/dbweb/main/AsokaMeeting.png" alt="Asoka" />
                <div className="meeting-overlay">
                  <span className="meeting-capacity">Up to 20 people</span>
                </div>
              </div>
              <div className="meeting-info">
                <h3>Asoka</h3>
                <p>Elegant space for executive meetings</p>
                <ul className="meeting-features">
                  <li><i className="fas fa-video"></i> Video Conference</li>
                  <li><i className="fas fa-print"></i> Printing Service</li>
                  <li><i className="fas fa-headset"></i> Technical Support</li>
                </ul>
              </div>
            </div>

            <div className="meeting-card">
              <div className="meeting-image">
                <img src="https://raw.githubusercontent.com/hfzt07/dbweb/main/KecombrangMeeting.png" alt="Kecombrang" />
                <div className="meeting-overlay">
                  <span className="meeting-capacity">Up to 20 people</span>
                </div>
              </div>
              <div className="meeting-info">
                <h3>Kecombrang</h3>
                <p>Perfect for intimate gatherings</p>
                <ul className="meeting-features">
                  <li><i className="fas fa-wifi"></i> High-speed WiFi</li>
                  <li><i className="fas fa-tv"></i> Projector & Screen</li>
                  <li><i className="fas fa-coffee"></i> Coffee Break</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="facilities" className="facilities-section">
        <h2 className="section-title">Our Facilities</h2>
        <div className="facilities-wrapper">
          <div className="facilities-container">
            <div className="facility-card">
              <div className="facility-image">
                <img src="https://raw.githubusercontent.com/hfzt07/dbweb/main/F-Swim.JPG" alt="Swimming Pool" loading="lazy" />
              </div>
              <div className="facility-content">
                <h3>Swimming Pool</h3>
                <p>Relax and swim in our refreshing pool</p>
              </div>
            </div>

            <div className="facility-card">
              <div className="facility-image">
                <img src="https://raw.githubusercontent.com/hfzt07/dbweb/main/F-PoolBar.JPG" alt="Teratai Pool Bar" loading="lazy" />
              </div>
              <div className="facility-content">
                <h3>Teratai Pool Bar</h3>
                <p>Enjoy drinks by the poolside</p>
              </div>
            </div>

            <div className="facility-card">
              <div className="facility-image">
                <img src="https://raw.githubusercontent.com/hfzt07/dbweb/main/F-Amphy.JPG" alt="Amphy Theater" loading="lazy" />
              </div>
              <div className="facility-content">
                <h3>Amphy Theater</h3>
                <p>Experience entertainment in our outdoor theater</p>
              </div>
            </div>

            <div className="facility-card">
              <div className="facility-image">
                <img src="https://raw.githubusercontent.com/hfzt07/dbweb/main/F-KidsCorner.JPG" alt="Kids Corner" loading="lazy" />
              </div>
              <div className="facility-content">
                <h3>Kids Corner</h3>
                <p>Fun activities for children</p>
              </div>
            </div>

            <div className="facility-card">
              <div className="facility-image">
                <img src="https://raw.githubusercontent.com/hfzt07/dbweb/main/F-Billiard.JPG" alt="Billiard Room" loading="lazy" />
              </div>
              <div className="facility-content">
                <h3>Billiard Room</h3>
                <p>Professional billiard tables for your entertainment</p>
              </div>
            </div>

            <div className="facility-card">
              <div className="facility-image">
                <img src="https://raw.githubusercontent.com/hfzt07/dbweb/main/F-Basket.JPG" alt="Basketball Court" loading="lazy" />
              </div>
              <div className="facility-content">
                <h3>Basketball Court</h3>
                <p>Indoor basketball court for sports enthusiasts</p>
              </div>
            </div>

            <div className="facility-card">
              <div className="facility-image">
                <img src="https://raw.githubusercontent.com/hfzt07/dbweb/main/F-Pray.JPG" alt="Pray Area" loading="lazy" />
              </div>
              <div className="facility-content">
                <h3>Pray Area</h3>
                <p>Pray Area for Muslim guests</p>
              </div>
            </div>

            <div className="facility-card">
              <div className="facility-image">
                <img src="https://raw.githubusercontent.com/hfzt07/dbweb/main/F-Waiting.JPG" alt="Waiting Room" loading="lazy" />
              </div>
              <div className="facility-content">
                <h3>Waiting Room</h3>
                <p>Comfortable waiting area with amenities</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="booking" className="booking-section">
        <h2 className="booking-title">Book Now</h2>
        <div className="booking-container">
          <div className="booking-form-container">
            <form className="booking-form" onSubmit={handleBookingSubmit}>
              <h3>Direct Booking</h3>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="name">Full Name</label>
                  <input
                    id="name"
                    type="text"
                    name="name"
                    value={bookingForm.name}
                    onChange={handleBookingChange}
                    placeholder="Enter your full name"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="email">Email Address</label>
                  <input
                    id="email"
                    type="email"
                    name="email"
                    value={bookingForm.email}
                    onChange={handleBookingChange}
                    placeholder="Enter your email"
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="roomType">Room Type</label>
                  <select
                    id="roomType"
                    name="roomType"
                    value={bookingForm.roomType}
                    onChange={handleBookingChange}
                    required
                  >
                    <option value="">Select Room Type</option>
                    {roomTypes.map((type, index) => (
                      <option key={index} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="stayDuration">Stay Duration</label>
                  <div className="date-range">
                    <input
                      type="date"
                      id="checkIn"
                      name="checkIn"
                      value={bookingForm.checkIn}
                      onChange={handleDateChange}
                      min={new Date().toISOString().split('T')[0]}
                    />
                    <span className="date-separator">to</span>
                    <input
                      type="date"
                      id="checkOut"
                      name="checkOut"
                      value={bookingForm.checkOut}
                      onChange={handleDateChange}
                      min={bookingForm.checkIn || new Date().toISOString().split('T')[0]}
                    />
                  </div>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="note">Additional Notes</label>
                  <textarea
                    id="note"
                    name="note"
                    value={bookingForm.note}
                    onChange={handleBookingChange}
                    placeholder="Any special requests or requirements"
                    rows="4"
                  ></textarea>
                </div>
                <div className="form-group captcha-group">
                  <label>Verification Code</label>
                  <div className="captcha-box">
                    <div className="captcha-text">{captchaText}</div>
                    <button type="button" className="refresh-captcha" onClick={generateCaptcha}>
                      <i className="fas fa-sync-alt"></i>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={captchaInput}
                    onChange={(e) => setCaptchaInput(e.target.value)}
                    placeholder="Enter the code"
                    className={`captcha-input ${captchaError ? 'error' : ''}`}
                    required
                  />
                  {captchaError && <div className="captcha-error">Invalid code. Please try again.</div>}
                </div>
              </div>
              {totalPrice > 0 && (
                <div className="total-price-display">
                  <h4>Harga per malam: Rp {roomPrice.toLocaleString()}</h4>
                  <h4>Total Harga: Rp {totalPrice.toLocaleString()}</h4>
                  <p>
                    Durasi: {Math.ceil((new Date(bookingForm.checkOut) - new Date(bookingForm.checkIn)) / (1000 * 60 * 60 * 24)) + 1} hari (
                    {Math.ceil((new Date(bookingForm.checkOut) - new Date(bookingForm.checkIn)) / (1000 * 60 * 60 * 24))} malam)
                  </p>
                </div>
              )}
              <button type="submit" className="submit-btn">Submit Booking</button>
            </form>
          </div>

          <div className="booking-partners">
            <h3>Our Partners</h3>
            <div className="booking-grid">
              <div className="booking-card">
                <img src="https://d1785e74lyxkqq.cloudfront.net/_next/static/v2/3/30bf6c528078ba28d34bc3e37d124bdb.svg" alt="Traveloka" />
                <h3>Traveloka</h3>
                <a href="https://www.traveloka.com/en-id/hotel/detail?spec=21-04-2025.22-04-2025.1.1.HOTEL.3000020007184.Amanuba%20Hotel%20%26%20Resort%20Rancamaya.2&contexts=%7B%22inventoryRateKey%22%3A%22povEwB3ZzsU2C6pd%2B6MdU13LUNuufACdbU0usK5vg0dC3ARMy9PTOAvzht2Ck0%2FffwxXnYiRzoxM4HX9sDmt9%2FAm1AYn3MeGz8Xcpq5hCtgkoYhCABuc4UBUJdDpIzcBkjYFe7E9Hsd3uMKwzSkUl5pNkVNrbZlWauR9OJSMSOiXRHzAZDWeuG0F1hB7SR6yREI7T92KXk5KTznM%2FtBP0o%2BbdPKyeEcnUCrwiPsukDU4xJaQCNZd7Dm9H%2BzKz3SoHlBcSNHFk%2B6M%2Bed81rVbweEHGIhg0KJ7gZAJpw17ItAcEtGPm1fxqcNnBgMR8yyW1sZzZUPnQEhjcdOYyNdSVblS81%2FL314%2BEun2%2FX6YDWiNLAI570pDjkIGC%2BnLzxKIDwdwsYGQWlaxhBsYTfbOupZ%2F4BcR1dMJZnHguitAKG4X9miO2YGoEGu3nxu%2BeSyOmEAQvSMnVoIA9pZMtQ8Ze0TmUfsKSaG4pRlRUA016Gk6lJCofqZhJ0CASfFAoDcsefho0o7KgbsmK2jlIeR2OjRtcdHHo%2FAWwEPDHg90N1R9O21BdVMumhKJ1LZWTYhAqtovf7l7Wh6O7acT8Ie56zkjUbMpMwoD8bDdfSrNvYejJhdEEziI4Xl3iRJYHk49zVKWfYDUVqNo%2FAall9xaEyEK9O99OH61qFyFDuZgvqejDkL7D4%2BWx6vTjIznXVzzxfH2bKUpSjEuA6nReUpwnj9BywmN88rYjc4iuYp6%2Flnq%2BDP4hQdJgnG%2BkfzeXdYclfxQK1kTlJUI3DHN0EvwNELADmhuhvMZhbVXxqvvmjb36jgruoUXlXJglH4Qjx1rUVyY4QHyTIIsa4hJL78hBhnsuGjNIa8TFVFxXBKa3rThY8Q89DAb2xlIP5cy2xPvFnSk625XvNS6hBLsZ3JeRqFpSIX%2BydxacpJb7fXWYX%2FlmOLA1AAHaiHIf7fDXLgKYw4eWA7sOT3HyFcsi85c5aYFtJBn5IvCXtl3m060X7RzJ6UsgLw9fpdXTqtFLfTMWNg%2B4O6iSHLFbf5X7a0HibLxC6VZPfkYeREumoct5C18Krcgf0H5k0uxoyr1z74Qehv3mloSsYzf0jI6KrpzKRAdF92NFpyk6wLvwBDdUgLLyO0Wh2ZxHg1FAy1fiW02GfY46FxOGtC1i3rktXeAqMmEh780bmr1Q%2BL%2BAEoledvCsWTtPIDnaEqN5YOJYNmL%22%7D&loginPromo=1&prevSearchId=1829907813303872645" target="_blank" rel="noopener noreferrer">Book Now</a>
              </div>
              <div className="booking-card">
                <img src="https://cdn6.agoda.net/images/kite-js/logo/agoda/color-default.svg" alt="Agoda" />
                <h3>Agoda</h3>
                <a href="https://www.agoda.com/en-gb/amanuba-hotel-resort-rancamaya_2/hotel/bogor-id.html?countryId=192&finalPriceView=1&isShowMobileAppPrice=false&cid=-1&numberOfBedrooms=&familyMode=false&adults=2&children=0&rooms=1&maxRooms=0&checkIn=2025-04-30&isCalendarCallout=false&childAges=&numberOfGuest=0&missingChildAges=false&travellerType=1&showReviewSubmissionEntry=false&currencyCode=IDR&isFreeOccSearch=false&los=2&searchrequestid=f12904ee-604e-4d69-bb03-b1de45487288&ds=fK1g5s1UnMCG1AAl" target="_blank" rel="noopener noreferrer">Book Now</a>
              </div>
              <div className="booking-card">
                <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/Booking.com_logo.svg/2560px-Booking.com_logo.svg.png" alt="Booking.com" />
                <h3>Booking.com</h3>
                <a href="https://www.booking.com/hotel/id/amanuba-amp-resort-rancamaya.en-gb.html?aid=304142&label=gen173nr-1FCAEoggI46AdIM1gEaGiIAQGYAQm4ARfIAQzYAQHoAQH4AQyIAgGoAgO4AoLSksAGwAIB0gIkMDU5NDNmMjgtNGYzMC00N2M5LTg1N2UtYmNiNjU4Njg0MzAw2AIG4AIB&sid=e8b62bcf50142f3cd52e4dfba693537f&dest_id=2895063&dest_type=hotel&dist=0&group_adults=2&group_children=0&hapos=1&hpos=1&no_rooms=1&req_adults=2&req_children=0&room1=A%2CA&sb_price_type=total&sr_order=popularity&srepoch=1745135896&srpvid=d5b2380a1a6314d3&type=total&ucfs=1&" target="_blank" rel="noopener noreferrer">Book Now</a>
              </div>
              <div className="booking-card">
                <div style={{ 
                  width: '120px', 
                  height: '40px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  color: '#e70033',
                  fontSize: '24px',
                  fontWeight: 'bold',
                  fontFamily: 'Arial, sans-serif'
                }}>
                  tiket.com
                </div>
                <h3>Tiket.com</h3>
                <a href="https://www.tiket.com/hotel/indonesia/amanuba-hotel-resort-rancamaya-412001639107159766?adult=1&room=1&source=global_search" target="_blank" rel="noopener noreferrer">Book Now</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="contact" className="contact-section">
        <h2 className="section-title">Contact Us</h2>
        <div className="contact-container">
          <div className="contact-info">
            <h3>Get in Touch</h3>
            <div className="contact-details">
            <p><i className="fas fa-map-marker-alt"></i> Jl. Rancamaya No.37, Bojongkerta, Bogor Selatan, <br />Kota Bogor, Jawa Barat 16139</p>
            <p><i className="fas fa-phone"></i> (0251) 8292821</p>
              <p><i className="fas fa-envelope"></i> info@amanurancamaya.com</p>
              <p><i className="fas fa-clock"></i> 24/7 Available</p>
            </div>
            <div className="social-links">
              <a href="#" aria-label="Facebook"><i className="fab fa-facebook-f"></i></a>
              <a href="#" aria-label="Twitter"><i className="fab fa-twitter"></i></a>
              <a href="#" aria-label="Instagram"><i className="fab fa-instagram"></i></a>
            </div>
          </div>
          <form className="contact-form" onSubmit={handleContactSubmit}>
            <h3>Email Us!</h3>
            <div className="form-group">
              <input 
                type="text" 
                name="name"
                value={contactForm.name}
                onChange={handleContactChange}
                placeholder="Your Name" 
                required 
              />
            </div>
            <div className="form-group">
              <input 
                type="email" 
                name="email"
                value={contactForm.email}
                onChange={handleContactChange}
                placeholder="Your Email" 
                required 
              />
            </div>
            <div className="form-group">
              <input 
                type="text" 
                name="subject"
                value={contactForm.subject}
                onChange={handleContactChange}
                placeholder="Subject" 
                required 
              />
            </div>
            <div className="form-group">
              <textarea 
                name="message"
                value={contactForm.message}
                onChange={handleContactChange}
                placeholder="Your Message" 
                required
              ></textarea>
            </div>
            <button 
              type="submit" 
              className={`submit-btn ${isSubmitting ? 'submitting' : ''}`}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i>
                  Sending...
                </>
              ) : (
                <>
                  <i className="fas fa-paper-plane"></i>
                  Send Message
                </>
              )}
            </button>
            {submitSuccess && (
              <div className="success-message">
                <i className="fas fa-check-circle"></i>
                Message sent successfully!
              </div>
            )}
          </form>
        </div>
      </section>

      <footer className="footer">
        <div className="footer-content">
          <div className="footer-section">
            <h3>Amanuba Hotel</h3>
            <p>Experience luxury and comfort in the heart of the city. Your perfect getaway destination with world-class amenities and exceptional service.</p>
            <div className="social-links">
              <a href="#" aria-label="Facebook"><i className="fab fa-facebook-f"></i></a>
              <a href="#" aria-label="Twitter"><i className="fab fa-twitter"></i></a>
              <a href="#" aria-label="Instagram"><i className="fab fa-instagram"></i></a>
            </div>
          </div>
          <div className="footer-section">
            <h3>Quick Links</h3>
            <ul>
              <li 
              onClick={() => {document.getElementById('home')?.scrollIntoView({ behavior: 'smooth' })
              setActiveSection('home')}}
              ><i></i> Home</li>
              <li 
              onClick={() => {document.getElementById('rooms')?.scrollIntoView({ behavior: 'smooth' })
              setActiveSection('rooms')}}
              ><i></i> Rooms</li>
              <li 
              onClick={() => {document.getElementById('facilities')?.scrollIntoView({ behavior: 'smooth' })
              setActiveSection('facilities')}}
              ><i></i> Facilities</li>
              <li 
              onClick={() => {document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' })
              setActiveSection('booking')}}
              ><i></i> Book</li>
              <li 
              onClick={() => {document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })
              setActiveSection('contact')}}
              ><i></i> Contact</li>
            </ul>
          </div>
          <div className="footer-section">
            <h3>Contact Info</h3>
            <ul>
              <li><i className="fas fa-map-marker-alt"></i> 123 Hotel Street, City</li>
              <li><i className="fas fa-phone"></i> +1 234 567 890</li>
              <li><i className="fas fa-envelope"></i> info@amanubahotel.com</li>
              <li><i className="fas fa-clock"></i> 24/7 Available</li>
            </ul>
          </div>
        </div>
        <div className="map-container">
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d10743.534559845937!2d106.83167794346427!3d-6.663220852214681!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e69c8d8e07f99a5%3A0x72c3b8c63b08eec6!2sAMANUBA%20Hotel%20%26%20Resort%20Rancamaya%20Bogor!5e1!3m2!1sid!2sid!4v1745136918355!5m2!1sid!2sid"
            allowFullScreen=""
            loading="lazy"
            title="Hotel Location"
          />
        </div>
        <div className="footer-bottom">
          <p>&copy; 2025 Amanuba Hotel. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}

export default Profile 