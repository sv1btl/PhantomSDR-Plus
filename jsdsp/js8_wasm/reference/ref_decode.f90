! ref_decode.f90 — run JS8Call's OWN JS8 Normal decoder over a raw recording.
!
! Ground truth for the A/B in Phase 7. Everything else in the JS8 suite is
! checked against JS8Call's encoder or its unpackers; this is the only thing
! that checks our RECEIVER against theirs, on identical audio.
!
! Reads float32 mono at 12 kHz from stdin-named file, slices it into
! UTC-aligned 15 s slots, and calls js8a_decode's decode() on each. Every
! decode is printed as
!     DEC <slotIndex> <snr> <dt> <freq> <message>
! so the comparison script can diff it against ours line for line.
!
! Usage: ref_decode <file.f32> <startOffsetSamples> <numSlots>

module ref_cb
  use js8a_decode
  implicit none
  type, extends(js8a_decoder) :: ref_decoder
  end type ref_decoder
  integer :: cur_slot = 0
contains
  subroutine ref_callback(this, snr, dt, freq, decoded, nap, qual)
    implicit none
    class(js8a_decoder), intent(inout) :: this
    integer, intent(in) :: snr
    real, intent(in) :: dt
    real, intent(in) :: freq
    character(len=37), intent(in) :: decoded
    integer, intent(in) :: nap
    real, intent(in) :: qual
    write(*,'(A,I4,I5,F7.2,F9.1,A,A)') 'DEC ', cur_slot, snr, dt, freq, ' ', trim(decoded)
    flush(6)
  end subroutine ref_callback
end module ref_cb

program ref_decode
  use js8a_decode
  use js8a_module
  use ref_cb
  implicit none

  character(len=512) :: path, arg
  integer :: startOff, nslots, i, k, ios, nread
  real(kind=4), allocatable :: buf(:)
  integer*2 :: iwave(NMAX)
  type(ref_decoder) :: dec
  integer :: fsize, nsamp
  real :: scale
  ! decode() ASSIGNS to newdat internally ("I hijacked newdat" in the upstream
  ! source), so every argument must be a variable -- passing a literal .true.
  ! puts a read-only constant where it writes, and it segfaults on line 74.
  logical :: newdat, nagain, syncStats
  integer :: nfqso, nutc, nfa, nfb, ndepth, napwid

  call get_command_argument(1, path)
  call get_command_argument(2, arg); read(arg,*) startOff
  call get_command_argument(3, arg); read(arg,*) nslots

  ! Raw float32; size it from the file length.
  open(10, file=trim(path), access='stream', form='unformatted', status='old', iostat=ios)
  if (ios /= 0) then
     write(*,*) 'cannot open ', trim(path)
     stop 1
  end if
  inquire(10, size=fsize)
  nsamp = fsize / 4
  allocate(buf(nsamp))
  read(10) buf
  close(10)

  write(*,'(A,I10,A,I8)') '# samples ', nsamp, ' slots ', nslots
  flush(6)

  ! JS8Call works in 16-bit units; our capture is float in [-1,1) at a very low
  ! level, so scale to use the int16 range rather than quantising to silence.
  scale = 0.0
  do i = 1, nsamp
     if (abs(buf(i)) > scale) scale = abs(buf(i))
  end do
  if (scale <= 0.0) scale = 1.0
  scale = 20000.0 / scale

  do k = 0, nslots-1
     iwave = 0
     do i = 1, NMAX
        nread = startOff + k*15*12000 + i
        if (nread >= 1 .and. nread <= nsamp) then
           iwave(i) = int(buf(nread) * scale, 2)
        end if
     end do
     cur_slot = k
     newdat = .true.
     nagain = .false.
     syncStats = .false.
     nfqso = 1500
     nutc = 0
     nfa = 200
     nfb = 3000
     ndepth = 3          ! subtraction + 4 passes + bp/osd, JS8Call's "deep"
     napwid = 100
     call dec%decode(ref_callback, iwave, nfqso, newdat, nutc, nfa, nfb, &
                     ndepth, nagain, napwid, syncStats)
  end do
end program ref_decode
