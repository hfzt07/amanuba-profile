import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import DatePicker from 'react-datepicker'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import 'react-datepicker/dist/react-datepicker.css'
import '../styles/FrontOffice.css'

function FrontOffice() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')
  const [sortConfig, setSortConfig] = useState({ key: 'check_in_date', direction: 'asc' })
  const [dateRange, setDateRange] = useState([null, null])
  const [startDate, endDate] = dateRange
  const [occupancyData, setOccupancyData] = useState([
    { name: 'Booked', value: 0, color: '#FFB800' },
    { name: 'Checked In', value: 0, color: '#00A76F' },
    { name: 'Checked Out', value: 0, color: '#FF5630' },
    { name: 'Available', value: 50, color: '#637381' }
  ])
  const [chartDate, setChartDate] = useState(null)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [newStatus, setNewStatus] = useState('')
  const [currentView, setCurrentView] = useState('bookings') // 'bookings' or 'occupancy'
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false)
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('')
  const [bookingToDelete, setBookingToDelete] = useState(null)
  const [showStatusConfirmation, setShowStatusConfirmation] = useState(false)
  const [statusToUpdate, setStatusToUpdate] = useState({ bookingId: null, newStatus: null })

  useEffect(() => {
    fetchBookings()
    fetchOccupancyData()
  }, [filter, dateRange, chartDate])

  const fetchBookings = async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('booking')
        .select('*')
        .order('check_in_date', { ascending: true });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      if (startDate && endDate) {
        query = query
          .gte('check_in_date', startDate.toISOString().split('T')[0])
          .lte('check_out_date', endDate.toISOString().split('T')[0]);
      }

      const { data, error } = await query;

      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      setError(error.message);
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOccupancyData = async () => {
    try {
      let query = supabase
        .from('booking')
        .select('*');

      if (chartDate) {
        const dateStr = chartDate.toISOString().split('T')[0];
        query = query
          .lte('check_in_date', dateStr)
          .gte('check_out_date', dateStr);
      }

      const { data, error } = await query;

      if (error) throw error;

      const totalRooms = 50;
      const occupancyCounts = {
        'book': 0,
        'checked-in': 0,
        'checked-out': 0
      };

      // Hitung jumlah kamar untuk setiap status
      data.forEach(booking => {
        if (occupancyCounts.hasOwnProperty(booking.status)) {
          occupancyCounts[booking.status]++;
        }
      });

      const newOccupancyData = [
        { name: 'Booked', value: occupancyCounts['book'], color: '#FFB800' },
        { name: 'Checked In', value: occupancyCounts['checked-in'], color: '#00A76F' },
        { name: 'Checked Out', value: occupancyCounts['checked-out'], color: '#FF5630' },
        { name: 'Available', value: totalRooms - (occupancyCounts['book'] + occupancyCounts['checked-in'] + occupancyCounts['checked-out']), color: '#637381' }
      ];

      setOccupancyData(newOccupancyData);
    } catch (error) {
      console.error('Error fetching occupancy data:', error);
      setError('Error fetching occupancy data');
    }
  };

  const handleStatusChange = async (bookingId, newStatus) => {
    if (!bookingId || !newStatus) {
      setError('Booking ID and status are required');
      return;
    }

    // Get current booking status
    const currentBooking = bookings.find(b => b.book_id === bookingId);
    if (!currentBooking) {
      setError('Booking not found');
      return;
    }

    // Treat null status as 'book'
    const currentStatus = currentBooking.status || 'book';

    // Validate status flow - only allow one step forward
    const statusFlow = {
      'book': ['checked-in'],
      'checked-in': ['checked-out'],
      'checked-out': []
    };

    // Check if the new status is the next allowed status
    const nextAllowedStatus = statusFlow[currentStatus][0];
    if (newStatus !== nextAllowedStatus) {
      setError(`Invalid status change. Current status is ${currentStatus}, can only change to ${nextAllowedStatus || 'none'}`);
      return;
    }

    // Show confirmation dialog
    setStatusToUpdate({ bookingId, newStatus });
    setShowStatusConfirmation(true);
  };

  const handleDelete = async (bookingId) => {
    if (!bookingId) {
      setError('Invalid booking ID');
      return;
    }

    setBookingToDelete(bookingId);
    setShowDeleteConfirmation(true);
    setDeleteConfirmationText('');
  };

  const confirmDelete = async () => {
    if (deleteConfirmationText.toLowerCase() !== 'delete') {
      setError('Please type "delete" to confirm');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { error: deleteError } = await supabase
        .from('booking')
        .delete()
        .eq('book_id', bookingToDelete);

      if (deleteError) throw deleteError;

      // Refresh data
      const { data: updatedBookings, error: fetchError } = await supabase
        .from('booking')
        .select('*')
        .order('check_in_date', { ascending: true });

      if (fetchError) throw fetchError;

      setBookings(updatedBookings);
      await fetchOccupancyData();
      setShowDeleteConfirmation(false);
      setBookingToDelete(null);
      setDeleteConfirmationText('');
    } catch (error) {
      setError(error.message);
      console.error('Error deleting booking:', error);
    } finally {
      setLoading(false);
    }
  };

  const confirmStatusChange = async () => {
    const { bookingId, newStatus } = statusToUpdate;
    
    try {
      setLoading(true);
      setError(null);

      const { data: updatedBooking, error: updateError } = await supabase
        .from('booking')
        .update({ status: newStatus })
        .eq('book_id', bookingId)
        .select('*');

      if (updateError) {
        console.error('Error updating booking:', updateError);
        throw new Error('Failed to update booking status');
      }

      if (!updatedBooking || updatedBooking.length === 0) {
        throw new Error(`No booking found with ID: ${bookingId}`);
      }

      // Update the local state
      const updatedBookings = bookings.map(booking => 
        booking.book_id === bookingId 
          ? { ...booking, status: newStatus }
          : booking
      );

      setBookings(updatedBookings);
      setError(null);
      await fetchOccupancyData();
    } catch (error) {
      console.error('Error in confirmStatusChange:', error);
      setError(error.message);
    } finally {
      setLoading(false);
      setShowStatusConfirmation(false);
      setStatusToUpdate({ bookingId: null, newStatus: null });
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const handleSort = (key) => {
    let direction = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  const isBookingExpired = (checkInDate) => {
    const today = new Date()
    const checkIn = new Date(checkInDate)
    return checkIn < today
  }

  const sortedBookings = [...bookings].sort((a, b) => {
    if (sortConfig.direction === 'asc') {
      return a[sortConfig.key] > b[sortConfig.key] ? 1 : -1
    }
    return a[sortConfig.key] < b[sortConfig.key] ? 1 : -1
  })

  return (
    <div className="front-office">
      <div className="front-office-hero">
        <h1>Front Office Amanuba Hotel</h1>
        <p>Manage bookings and monitor room occupancy</p>
      </div>

      <div className="view-selector">
        <select 
          value={currentView}
          onChange={(e) => setCurrentView(e.target.value)}
          className="view-dropdown"
        >
          <option value="bookings">Bookings</option>
          <option value="occupancy">Occupancy</option>
        </select>
      </div>

      <div className="dashboard-content">
        {currentView === 'bookings' ? (
          <div className="dashboard-card">
            <div className="card-header">
              <h2>Bookings</h2>
              <div className="filter-controls">
                <div className="filter-group">
                  <label htmlFor="status-filter">Status:</label>
                  <select 
                    id="status-filter"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="status-dropdown"
                  >
                    <option value="all">All Bookings</option>
                    <option value="book">Booked</option>
                    <option value="checked-in">Checked In</option>
                    <option value="checked-out">Checked Out</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
                
                <div className="filter-group">
                  <label>Date Range:</label>
                  <DatePicker
                    selectsRange={true}
                    startDate={startDate}
                    endDate={endDate}
                    onChange={(update) => setDateRange(update)}
                    isClearable={true}
                    placeholderText="Select date range"
                    className="date-range-picker"
                    monthsShown={2}
                    showPopperArrow={false}
                  />
                </div>
              </div>
            </div>

            {error && <div className="error-message">{error}</div>}

            {loading ? (
              <div className="loading">Loading...</div>
            ) : (
              <div className="table-container">
                <table className="bookings-table">
                  <thead>
                    <tr>
                      <th onClick={() => handleSort('book_id')}>
                        Book ID {sortConfig.key === 'book_id' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                      <th onClick={() => handleSort('guest_name')}>
                        Guest Name {sortConfig.key === 'guest_name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                      <th onClick={() => handleSort('room_number')}>
                        Room {sortConfig.key === 'room_number' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                      <th onClick={() => handleSort('check_in_date')}>
                        Check In {sortConfig.key === 'check_in_date' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                      <th onClick={() => handleSort('check_out_date')}>
                        Check Out {sortConfig.key === 'check_out_date' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                      <th onClick={() => handleSort('total_price')}>
                        Total Price {sortConfig.key === 'total_price' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                      <th onClick={() => handleSort('status')}>
                        status {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedBookings.map((booking) => (
                      <tr key={`booking-${booking.book_id}`} className={isBookingExpired(booking.check_in_date) && booking.status === 'book' ? 'expired-booking' : ''}>
                        <td>{booking.book_id}</td>
                        <td>
                          <div className="guest-info">
                            <strong>{booking.guest_name}</strong>
                            {booking.guest_note && (
                              <span className="note-indicator" title={booking.guest_note}>📝</span>
                            )}
                          </div>
                        </td>
                        <td>{booking.room_number} ({booking.room_type})</td>
                        <td>{formatDate(booking.check_in_date)}</td>
                        <td>{formatDate(booking.check_out_date)}</td>
                        <td>{formatCurrency(booking.total_price)}</td>
                        <td>
                          {isBookingExpired(booking.check_in_date) && (booking.status === 'book' || !booking.status) ? (
                            <span className="status-badge expired">Expired</span>
                          ) : (
                            <select
                              value={booking.status || 'book'}
                              onChange={(e) => handleStatusChange(booking.book_id, e.target.value)}
                              className="status-select"
                              disabled={loading}
                            >
                              <option value={booking.status || 'book'}>{booking.status || 'Book'}</option>
                              {(booking.status === 'book' || !booking.status) && <option value="checked-in">Checked In</option>}
                              {booking.status === 'checked-in' && <option value="checked-out">Checked Out</option>}
                            </select>
                          )}
                        </td>
                        <td>
                          <div className="action-buttons">
                            <button 
                              className="delete-btn"
                              onClick={() => handleDelete(booking.book_id)}
                              disabled={loading}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="dashboard-card">
            <div className="card-header">
              <h2>Room Occupancy</h2>
              <div className="chart-date-picker">
                <DatePicker
                  selected={chartDate}
                  onChange={(date) => setChartDate(date)}
                  isClearable={true}
                  placeholderText="Select date"
                  className="date-picker"
                  showPopperArrow={false}
                />
              </div>
            </div>
            
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={occupancyData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {occupancyData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => [`${value} rooms`, '']}
                    labelFormatter={(label) => label}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {showStatusConfirmation && (
        <div className="confirmation-dialog">
          <div className="confirmation-content">
            <h3>Confirm Status Change</h3>
            <p>Are you sure you want to change the status from {bookings.find(b => b.book_id === statusToUpdate.bookingId)?.status || 'Book'} to {statusToUpdate.newStatus}?</p>
            <p>This action cannot be undone.</p>
            <div className="confirmation-buttons">
              <button 
                className="confirm-btn"
                onClick={confirmStatusChange}
              >
                Confirm
              </button>
              <button 
                className="cancel-btn"
                onClick={() => {
                  setShowStatusConfirmation(false);
                  setStatusToUpdate({ bookingId: null, newStatus: null });
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirmation && (
        <div className="confirmation-dialog">
          <div className="confirmation-content">
            <h3>Confirm Delete</h3>
            <p>Are you sure you want to delete this booking? This action cannot be undone.</p>
            <p>Type "delete" to confirm:</p>
            <input
              type="text"
              value={deleteConfirmationText}
              onChange={(e) => setDeleteConfirmationText(e.target.value)}
              placeholder="Type 'delete' to confirm"
              className="delete-confirmation-input"
            />
            <div className="confirmation-buttons">
              <button 
                className="confirm-btn"
                onClick={confirmDelete}
                disabled={deleteConfirmationText.toLowerCase() !== 'delete'}
              >
                Delete
              </button>
              <button 
                className="cancel-btn"
                onClick={() => {
                  setShowDeleteConfirmation(false);
                  setBookingToDelete(null);
                  setDeleteConfirmationText('');
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default FrontOffice 