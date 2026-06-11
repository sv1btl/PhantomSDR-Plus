#ifndef CRASH_HANDLER_H
#define CRASH_HANDLER_H

// Installs:
//   - signal handlers for SIGSEGV, SIGBUS, SIGFPE, SIGILL, SIGABRT, SIGPIPE
//     (each prints a backtrace + crash banner to stderr, then re-raises)
//   - std::terminate handler (prints uncaught-exception message + backtrace)
//   - std::set_unexpected (legacy; prints + aborts)
//
// Backtrace requires linking with -rdynamic for readable symbols.
void install_crash_handlers();

#endif // CRASH_HANDLER_H
