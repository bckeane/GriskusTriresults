"""Common data normalization utilities."""
import re


def to_title_case(s):
    if not s:
        return s
    # Preserve all-caps as title case, leave mixed-case as-is
    if s == s.upper():
        return s.title()
    return s


def clean_time(t):
    if not t:
        return ''
    t = str(t).strip()
    # Remove leading zeros from hours: 02:06:18 -> 2:06:18
    t = re.sub(r'^0(\d:\d{2}:\d{2})$', r'\1', t)
    return t


def infer_division(age, gender):
    if not age or not gender:
        return ''
    age = int(age)
    g = gender.upper()
    if age < 20:
        bracket = f'{(age // 5) * 5:02d}{(age // 5) * 5 + 4:02d}'
    else:
        bracket = f'{(age // 5) * 5}{(age // 5) * 5 + 4}'
    return f'{g}{bracket}'


def make_result(
    year, race_type, source,
    place=None, first_name='', last_name='',
    city='', state='', age=None, gender='',
    division='', div_place=None,
    total_time='', swim_time='', bike_time='', run_time='',
    bib='',
):
    first_name = to_title_case(first_name.strip()) if first_name else ''
    last_name = to_title_case(last_name.strip()) if last_name else ''
    full_name = f'{first_name} {last_name}'.strip()

    if not division and age and gender:
        division = infer_division(age, gender)

    return {
        'year': int(year),
        'raceType': race_type,
        'source': source,
        'place': int(place) if place else None,
        'firstName': first_name,
        'lastName': last_name,
        'fullName': full_name,
        'city': to_title_case(city.strip()) if city else '',
        'state': state.strip().upper() if state else '',
        'age': int(age) if age else None,
        'gender': gender.strip().upper() if gender else '',
        'division': division.strip().upper() if division else '',
        'divPlace': int(div_place) if div_place else None,
        'totalTime': clean_time(total_time),
        'swimTime': clean_time(swim_time),
        'bikeTime': clean_time(bike_time),
        'runTime': clean_time(run_time),
        'bib': str(bib).strip() if bib else '',
    }
