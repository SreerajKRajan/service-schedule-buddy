-- Update the job_status enum to change 'no_the_way' to 'on_the_way'
ALTER TYPE job_status RENAME VALUE 'no_the_way' TO 'on_the_way';