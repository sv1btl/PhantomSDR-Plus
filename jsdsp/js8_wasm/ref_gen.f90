! ref_gen.f90 — reference JS8 encoder driver built from unmodified JS8Call
! sources. Prints, for each test message, the 87 information bits and the 79
! channel tones produced by JS8Call's own genjs8().
program ref_gen
  character*22 msg, msgsent
  integer*1 msgbits(87)
  integer itone(79)
  integer icos, i3bit, i, n
  character*200 line

  do
     read(*,'(A)',end=99) line
     read(line(1:2),'(I2)') icos
     read(line(4:5),'(I2)') i3bit
     msg = line(7:28)
     call genjs8(msg, icos, i3bit, msgsent, msgbits, itone)
     write(*,'(A)',advance='no') 'BITS '
     do i=1,87
        write(*,'(I1)',advance='no') msgbits(i)
     enddo
     write(*,*)
     write(*,'(A)',advance='no') 'TONE '
     do i=1,79
        write(*,'(I1)',advance='no') itone(i)
     enddo
     write(*,*)
  enddo
99 continue
end program ref_gen
